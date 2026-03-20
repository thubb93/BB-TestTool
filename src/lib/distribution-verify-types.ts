/** Shared types for the Distribution Engine verification tool */

export type WindowCase = 'A' | 'B' | 'C';
export type CheckStatus = 'pass' | 'fail' | 'skip' | 'warn';

export interface PostInfo {
  id: number;
  name: string;
  status: string;
  startAt: string;
  endAt: string;
  windowHours: number;
  windowCase: WindowCase;
  postType: string;
  phase: string;
  distributionType: string;
  snsPlatforms: string[];
}

export interface CheckResult {
  id: string;
  name: string;
  status: CheckStatus;
  message: string;
  details?: string;
}

export interface TimeOfDayStats {
  morning: number;  // 0–100 percentage
  lunch: number;
  evening: number;
  other: number;
}

export interface AntiBurstViolation {
  windowStart: string;  // ISO string
  count: number;
  limit: number;
  type: '1min' | '5min';
}

export interface DistributionVerifyResult {
  post: PostInfo;
  assignedCount: number;
  checks: CheckResult[];
  timeOfDayStats: TimeOfDayStats;
  antiBurstViolations: AntiBurstViolation[];
  /** Raw rows from user_influencer_post (SELECT *, ORDER BY id DESC, no is_deleted filter) */
  rawRows: Record<string, unknown>[];
}
