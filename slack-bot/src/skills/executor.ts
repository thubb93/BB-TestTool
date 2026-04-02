import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs-extra'

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/Users/arrthur/Project/BB-TestTool'

export interface ExecutorResult {
  success: boolean
  output: string
  error?: string
}

/**
 * Chạy Claude Code CLI để invoke skill đúng cách.
 *
 * Invocation: claude -p "/qe:skill-name [filePath] [context...]"
 * - Chạy trong PROJECT_ROOT → Claude Code tự đọc .claude/skills/
 * - File path và conversation history được append vào argument của skill
 * - Claude Code handle skill workflow từ SKILL.md, không cần thêm gì
 */
export async function executeSkill(
  slashCommand: string,
  filePath: string | null,
  conversationHistory: string[] = [],
  extraContext?: string
): Promise<ExecutorResult> {
  const prompt = buildSkillPrompt(slashCommand, filePath, conversationHistory, extraContext)
  return runClaudeCLI(prompt)
}

function buildSkillPrompt(
  slashCommand: string,
  filePath: string | null,
  conversationHistory: string[],
  extraContext?: string
): string {
  // Base: "/qe:analyze-req /path/to/spec.md"
  const parts: string[] = [slashCommand]

  if (filePath) {
    parts.push(filePath)
  }

  // Context từ Slack thread append sau file path
  // Claude Code đọc đây như argument bổ sung cho skill
  if (conversationHistory.length > 0) {
    parts.push('\n\nContext bổ sung từ người dùng:')
    conversationHistory.forEach((msg, i) => {
      parts.push(`${i + 1}. ${msg}`)
    })
  }

  if (extraContext) {
    parts.push(`\n${extraContext}`)
  }

  return parts.join(' ')
}

function runClaudeCLI(prompt: string): Promise<ExecutorResult> {
  return new Promise((resolve) => {
    console.log(`[executor] Running claude CLI in: ${PROJECT_ROOT}`)
    console.log(`[executor] Prompt: ${prompt}`)

    // --dangerously-skip-permissions: bắt buộc cho non-interactive mode
    // vì Claude Code cần bypass permission prompts khi không có TTY
    const proc = spawn('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.on('error', (err) => {
      console.error('[executor] spawn error:', err)
      resolve({
        success: false,
        output: '',
        error: `Không thể chạy claude CLI: ${err.message}`,
      })
    })

    proc.on('close', (code) => {
      console.log(`[executor] Claude CLI exited with code: ${code}`)

      if (code === 0) {
        resolve({ success: true, output: stdout })
      } else {
        resolve({
          success: false,
          output: stdout,
          error: stderr || `Claude CLI exited with code ${code}`,
        })
      }
    })
  })
}

/**
 * Copy file từ /tmp vào project để claude có thể access
 */
export async function copyFileToProject(
  tmpPath: string,
  fileName: string
): Promise<string> {
  const dest = path.join(PROJECT_ROOT, 'spec', fileName)
  await fs.ensureDir(path.join(PROJECT_ROOT, 'spec'))
  await fs.copy(tmpPath, dest)
  return dest
}

/**
 * Dọn file đã copy sau khi xử lý xong
 */
export async function cleanupProjectFile(filePath: string): Promise<void> {
  await fs.remove(filePath).catch(() => {})
}
