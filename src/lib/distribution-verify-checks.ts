/** Individual verification check functions for the Distribution Engine */

import type { CheckResult, TimeOfDayStats, AntiBurstViolation, WindowCase } from './distribution-verify-types';

/** Classify a timestamp's hour into a time-of-day block */
export function classifyTod(d: Date): 'morning' | 'lunch' | 'evening' | 'other' {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 9) return 'morning';
  if (h >= 12 && h < 13.5) return 'lunch';
  if (h >= 18 && h < 21) return 'evening';
  return 'other';
}

/** Check all assignments fall within [startAt, endAt] */
export function checkWindowBounds(assignments: Date[], startAt: Date, endAt: Date): CheckResult {
  const outside = assignments.filter(d => d < startAt || d > endAt);
  return {
    id: 'window-bounds',
    name: 'All assignments within window',
    status: outside.length === 0 ? 'pass' : 'fail',
    message: outside.length === 0
      ? `All ${assignments.length} assignments within window`
      : `${outside.length} assignment(s) outside [startAt, endAt]`,
  };
}

/** Check Case A/B: all assignments in first 50% of window */
export function checkFirst50Pct(assignments: Date[], startAt: Date, endAt: Date, windowCase: WindowCase): CheckResult {
  if (windowCase === 'C') {
    return { id: 'first-50pct', name: 'First 50% rule (Case A/B)', status: 'skip', message: 'Not applicable for Case C' };
  }
  const halfway = new Date(startAt.getTime() + (endAt.getTime() - startAt.getTime()) / 2);
  const late = assignments.filter(d => d > halfway);
  return {
    id: 'first-50pct',
    name: 'All assigned in first 50% of window (Case A/B)',
    status: late.length === 0 ? 'pass' : 'fail',
    message: late.length === 0
      ? 'All assignments within first 50% of window'
      : `${late.length} assignment(s) in second half of window`,
    details: `Halfway point: ${halfway.toISOString()}`,
  };
}

/** Check time-of-day block distribution — required for Case B/C */
export function checkTodDistribution(windowCase: WindowCase, stats: TimeOfDayStats): CheckResult {
  if (windowCase === 'A') {
    return { id: 'tod-distribution', name: 'Time-of-day distribution', status: 'skip', message: 'Case A: time-of-day preferences not required' };
  }
  const inBlocks = 100 - stats.other;
  return {
    id: 'tod-distribution',
    name: 'Time-of-day block coverage (Case B/C, target ≥60%)',
    status: inBlocks >= 60 ? 'pass' : 'warn',
    message: `${inBlocks.toFixed(1)}% of assignments in morning/lunch/evening blocks`,
    details: `Morning ${stats.morning.toFixed(1)}%, Lunch ${stats.lunch.toFixed(1)}%, Evening ${stats.evening.toFixed(1)}%, Other ${stats.other.toFixed(1)}%`,
  };
}

/** Check Case C rotation split: Morning 20%, Lunch 20%, Evening 60% (±5% tolerance) */
export function checkRotation(stats: TimeOfDayStats, windowCase: WindowCase, distributionType: string): CheckResult {
  const applicable = windowCase === 'C' && (distributionType === 'ROTATION' || distributionType === 'BOTH');
  if (!applicable) {
    return { id: 'rotation-pct', name: 'Rotation split 20/20/60 (Case C)', status: 'skip', message: `Not applicable (Case ${windowCase}, dist: ${distributionType})` };
  }
  const T = 5;
  const mOk = Math.abs(stats.morning - 20) <= T;
  const lOk = Math.abs(stats.lunch - 20) <= T;
  const eOk = Math.abs(stats.evening - 60) <= T;
  return {
    id: 'rotation-pct',
    name: 'Rotation split Morning/Lunch/Evening (20/20/60 ±5%)',
    status: mOk && lOk && eOk ? 'pass' : 'fail',
    message: mOk && lOk && eOk ? 'Rotation split within tolerance' : 'Rotation split out of tolerance',
    details: `Morning ${stats.morning.toFixed(1)}% (expect 20±5%), Lunch ${stats.lunch.toFixed(1)}% (expect 20±5%), Evening ${stats.evening.toFixed(1)}% (expect 60±5%)`,
  };
}

/** Check anti-burst constraints. Skipped if window < 2h. Uses assignedCount as proxy for eligibleCount. */
export function checkAntiBurst(
  assignments: Date[],
  windowHours: number,
  assignedCount: number
): { check1min: CheckResult; check5min: CheckResult; violations: AntiBurstViolation[] } {
  if (windowHours < 2 || assignedCount === 0) {
    const msg = windowHours < 2 ? 'Window < 2h — anti-burst check skipped' : 'No assignments';
    return {
      check1min: { id: 'anti-burst-1min', name: 'Anti-burst 1min (0.7%/min)', status: 'skip', message: msg },
      check5min: { id: 'anti-burst-5min', name: 'Anti-burst 5min (3.5%/5min)', status: 'skip', message: msg },
      violations: [],
    };
  }

  const lim1 = Math.max(1, Math.ceil(assignedCount * 0.007));
  const lim5 = Math.max(1, Math.ceil(assignedCount * 0.035));
  const violations: AntiBurstViolation[] = [];

  const b1 = new Map<number, number>();
  const b5 = new Map<number, number>();
  for (const d of assignments) {
    const t = d.getTime();
    const k1 = Math.floor(t / 60000);
    const k5 = Math.floor(t / 300000);
    b1.set(k1, (b1.get(k1) ?? 0) + 1);
    b5.set(k5, (b5.get(k5) ?? 0) + 1);
  }
  for (const [k, cnt] of b1) {
    if (cnt > lim1) violations.push({ windowStart: new Date(k * 60000).toISOString(), count: cnt, limit: lim1, type: '1min' });
  }
  for (const [k, cnt] of b5) {
    if (cnt > lim5) violations.push({ windowStart: new Date(k * 300000).toISOString(), count: cnt, limit: lim5, type: '5min' });
  }

  const v1 = violations.filter(v => v.type === '1min');
  const v5 = violations.filter(v => v.type === '5min');
  return {
    check1min: {
      id: 'anti-burst-1min',
      name: 'Anti-burst 1min (max 0.7% per minute)',
      status: v1.length ? 'fail' : 'pass',
      message: v1.length ? `${v1.length} minute bucket(s) exceed limit of ${lim1}` : `No 1-min bursts (limit: ${lim1}/min)`,
    },
    check5min: {
      id: 'anti-burst-5min',
      name: 'Anti-burst 5min (max 3.5% per 5 minutes)',
      status: v5.length ? 'fail' : 'pass',
      message: v5.length ? `${v5.length} 5-min bucket(s) exceed limit of ${lim5}` : `No 5-min bursts (limit: ${lim5}/5min)`,
    },
    violations,
  };
}
