import * as fs from 'fs-extra'
import * as path from 'path'

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/Users/arrthur/Project/BB-TestTool'
const REPORTS_DIR = path.join(PROJECT_ROOT, 'qe-reports')

/**
 * Lấy report mới nhất theo prefix (vd: "req-analysis", "test-plan")
 */
export async function getLatestReport(prefix: string): Promise<string | null> {
  await fs.ensureDir(REPORTS_DIR)

  const files = await fs.readdir(REPORTS_DIR)
  const matching = files
    .filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
    .sort()
    .reverse() // newest first (YYYY-MM-DD sort)

  if (matching.length === 0) return null

  const latestPath = path.join(REPORTS_DIR, matching[0])
  return fs.readFile(latestPath, 'utf-8')
}

/**
 * Watch thư mục report cho đến khi file mới xuất hiện, hoặc timeout
 */
export async function waitForNewReport(
  prefix: string,
  beforeTimestamp: number,
  timeoutMs = 120_000
): Promise<string | null> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    await sleep(2000)

    const files = await fs.readdir(REPORTS_DIR).catch(() => [])
    const matching = files
      .filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
      .sort()
      .reverse()

    if (matching.length > 0) {
      const latestPath = path.join(REPORTS_DIR, matching[0])
      const stat = await fs.stat(latestPath)

      // File mới hơn thời điểm bắt đầu chạy
      if (stat.mtimeMs > beforeTimestamp) {
        return fs.readFile(latestPath, 'utf-8')
      }
    }
  }

  return null // timeout
}

/**
 * Truncate nội dung dài cho Slack (max 3000 chars per block)
 */
export function truncateForSlack(content: string, maxLen = 2800): string {
  if (content.length <= maxLen) return content
  return content.slice(0, maxLen) + '\n\n_...[ truncated — xem full report trong qe-reports/ ]_'
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
