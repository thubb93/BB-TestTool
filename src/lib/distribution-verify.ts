/** Distribution Engine Verification — build queries and run verification logic */

import type { DistributionVerifyResult, PostInfo, TimeOfDayStats, WindowCase, CheckResult, AntiBurstViolation } from './distribution-verify-types';
import {
  classifyTod,
  checkWindowBounds,
  checkFirst50Pct,
  checkTodDistribution,
  checkRotation,
  checkAntiBurst,
} from './distribution-verify-checks';

/** Build the 2 primary SQL queries (post info + assignments) */
export function buildMainQueries(postId: string | number): string[] {
  const id = Number(postId);
  return [
    // influencer_post: columns confirmed from API payload (camelCase → snake_case)
    `SELECT id, post_name, status, start_at, end_at, post_type, apply_to_phase, distribution_type
     FROM influencer_post WHERE id = ${id}`,
    // user_influencer_post: fetch all columns, no is_deleted filter — full visibility for QA
    `SELECT * FROM user_influencer_post WHERE influencer_post_id = ${id} ORDER BY id DESC`,
  ];
}

/** Build SNS platform query — run separately so failures don't block verification */
export function buildSnsQuery(postId: string | number): string {
  const id = Number(postId);
  // influencer_post_detail: one row per SNS platform (maps to publishedTo array in API)
  return `SELECT sns_platform FROM influencer_post_detail WHERE influencer_post_id = ${id}`;
}

/** @deprecated Use buildMainQueries + buildSnsQuery instead */
export function buildQueries(postId: string | number): string[] {
  return [...buildMainQueries(postId).slice(0, 1), buildSnsQuery(postId), ...buildMainQueries(postId).slice(1)];
}

function toDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}

function getWindowCase(hours: number): WindowCase {
  if (hours <= 24) return 'A';
  if (hours < 48) return 'B';
  return 'C';
}

/**
 * Run distribution engine verification against raw DB query results.
 * @param postRows - rows from influencer_post query
 * @param detailRows - rows from influencer_post_detail query
 * @param assignmentRows - rows from user_influencer_post query
 * @param _simulatedNow - reserved for future time override support
 */
export function runVerification(
  postRows: unknown[],
  detailRows: unknown[],
  assignmentRows: unknown[],
  _simulatedNow?: string
): DistributionVerifyResult {
  const postRow = (postRows as Record<string, unknown>[])[0];
  if (!postRow) throw new Error('Post not found — check post ID and DB connection');

  const startAt = toDate(postRow.start_at);
  const endAt = toDate(postRow.end_at);
  const windowHours = (endAt.getTime() - startAt.getTime()) / 3600000;
  const windowCase = getWindowCase(windowHours);

  // influencer_post_detail: each row has sns_platform (one per publishedTo entry)
  const snsPlatforms = (detailRows as Record<string, unknown>[])
    .map(r => String(r.sns_platform ?? '')).filter(Boolean);

  const post: PostInfo = {
    id: Number(postRow.id),
    name: String(postRow.post_name ?? ''),
    status: String(postRow.status ?? ''),
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    windowHours: Math.round(windowHours * 100) / 100,
    windowCase,
    postType: String(postRow.post_type ?? ''),
    phase: String(postRow.apply_to_phase ?? ''),
    distributionType: String(postRow.distribution_type ?? ''),
    snsPlatforms,
  };

  // Only count NEW status rows
  const assignmentRows2 = (assignmentRows as Record<string, unknown>[])
    .filter(r => String(r.status ?? '') === 'NEW');
  // assignedCount: total scheduled rows (for display)
  const assignedCount = assignmentRows2.length;

  // All checks use deliver_at — only rows that have been delivered
  const deliveries = assignmentRows2
    .map(r => r.deliver_at)
    .filter((v): v is unknown => v != null && String(v) !== '')
    .map(v => toDate(v));
  const deliveredCount = deliveries.length;

  // Time-of-day stats
  const tod = { morning: 0, lunch: 0, evening: 0, other: 0 };
  for (const d of deliveries) tod[classifyTod(d)]++;
  const timeOfDayStats: TimeOfDayStats = {
    morning: deliveredCount ? (tod.morning / deliveredCount) * 100 : 0,
    lunch: deliveredCount ? (tod.lunch / deliveredCount) * 100 : 0,
    evening: deliveredCount ? (tod.evening / deliveredCount) * 100 : 0,
    other: deliveredCount ? (tod.other / deliveredCount) * 100 : 0,
  };

  // Anti-burst: only for RANDOM_DELAY
  let check1min: CheckResult, check5min: CheckResult, violations: AntiBurstViolation[];
  if (post.distributionType !== 'RANDOM_DELAY') {
    const skipMsg = `Only applicable for RANDOM_DELAY (mode: ${post.distributionType})`;
    check1min = { id: 'anti-burst-1min', name: 'Anti-burst 1min (max 0.7% per minute)', status: 'skip', message: skipMsg };
    check5min = { id: 'anti-burst-5min', name: 'Anti-burst 5min (max 3.5% per 5 minutes)', status: 'skip', message: skipMsg };
    violations = [];
  } else {
    ({ check1min, check5min, violations } = checkAntiBurst(deliveries, windowHours, deliveredCount));
  }

  return {
    post,
    assignedCount,
    checks: [
      checkWindowBounds(deliveries, startAt, endAt),
      checkFirst50Pct(deliveries, startAt, endAt, windowCase),
      checkTodDistribution(windowCase, timeOfDayStats),
      checkRotation(timeOfDayStats, windowCase, post.distributionType),
      check1min,
      check5min,
    ],
    timeOfDayStats,
    antiBurstViolations: violations,
    rawRows: assignmentRows as Record<string, unknown>[],
  };
}
