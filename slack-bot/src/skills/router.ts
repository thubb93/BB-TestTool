/**
 * Intent Router — map từ Slack message text → skill cần gọi
 */

export type SkillName =
  | 'qe-analyze-req'
  | 'qe-test-plan'
  | 'qe-test-case'
  | 'qe-e2e'
  | 'qe-api-test'
  | 'qe-security'
  | 'qe-perf'
  | 'qe-report'
  | 'unknown'

export interface RoutedIntent {
  skill: SkillName
  reportPrefix: string
  slashCommand: string
  label: string
  description: string
}

const SKILL_MAP: Array<{ patterns: RegExp[]; intent: RoutedIntent }> = [
  {
    patterns: [
      /\/qe:analyze-req/i,         // gọi trực tiếp slash command
      /qe:analyze-req/i,
      /phân tích requirement/i,
      /analyze req/i,
      /analyze requirement/i,
      /review requirement/i,
      /kiểm tra requirement/i,
      /check requirement/i,
      /review spec/i,
      /phân tích spec/i,
    ],
    intent: {
      skill: 'qe-analyze-req',
      reportPrefix: 'req-analysis',
      slashCommand: '/qe:analyze-req',
      label: 'Requirement Analysis',
      description: 'Phân tích testability, completeness, và acceptance criteria',
    },
  },
  {
    patterns: [
      /\/qe:test-plan/i,
      /qe:test-plan/i,
      /tạo test plan/i,
      /create test plan/i,
      /make test plan/i,
      /lập test plan/i,
      /generate test plan/i,
    ],
    intent: {
      skill: 'qe-test-plan',
      reportPrefix: 'test-plan',
      slashCommand: '/qe:test-plan',
      label: 'Test Plan',
      description: 'Tạo kế hoạch kiểm thử từ requirements',
    },
  },
  {
    patterns: [
      /\/qe:test-case/i,
      /qe:test-case/i,
      /tạo test case/i,
      /generate test case/i,
      /create test case/i,
      /viết test case/i,
      /sinh test case/i,
    ],
    intent: {
      skill: 'qe-test-case',
      reportPrefix: 'test-case',
      slashCommand: '/qe:test-case',
      label: 'Test Cases',
      description: 'Generate test cases với happy path, edge cases, error scenarios',
    },
  },
  {
    patterns: [
      /\/qe:e2e/i,
      /qe:e2e/i,
      /chạy e2e/i,
      /run e2e/i,
      /chạy playwright/i,
      /run playwright/i,
      /e2e test/i,
    ],
    intent: {
      skill: 'qe-e2e',
      reportPrefix: 'e2e',
      slashCommand: '/qe:e2e',
      label: 'E2E Tests',
      description: 'Chạy Playwright E2E test suite',
    },
  },
  {
    patterns: [
      /\/qe:security/i,
      /qe:security/i,
      /security/i,
      /bảo mật/i,
      /vulnerability/i,
      /scan security/i,
      /kiểm tra bảo mật/i,
    ],
    intent: {
      skill: 'qe-security',
      reportPrefix: 'security',
      slashCommand: '/qe:security',
      label: 'Security Audit',
      description: 'OWASP Top 10 scan và kiểm tra bảo mật',
    },
  },
  {
    patterns: [
      /\/qe:report/i,
      /qe:report/i,
      /báo cáo/i,
      /tổng kết/i,
      /summary/i,
    ],
    intent: {
      skill: 'qe-report',
      reportPrefix: 'summary',
      slashCommand: '/qe:report',
      label: 'QA Report',
      description: 'Tổng hợp kết quả tất cả test trong cycle',
    },
  },
]

export function detectIntent(text: string): RoutedIntent {
  const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim() // remove @mention

  for (const { patterns, intent } of SKILL_MAP) {
    if (patterns.some((p) => p.test(cleanText))) {
      return intent
    }
  }

  return {
    skill: 'unknown',
    reportPrefix: '',
    slashCommand: '',
    label: 'Unknown',
    description: '',
  }
}

export function getHelpText(): string {
  const lines = SKILL_MAP.map(({ intent }) =>
    `• *${intent.label}* — \`${intent.slashCommand}\`\n  _${intent.description}_`
  )
  return lines.join('\n\n')
}
