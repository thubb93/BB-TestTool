import type { App } from '@slack/bolt'
import {
  getSession,
  appendMessage,
  updateStatus,
  deleteSession,
  hasActiveSession,
} from '../store/session'
import { executeSkill } from '../skills/executor'
import { waitForNewReport, truncateForSlack } from '../utils/report'
import { cleanupFile } from '../utils/slack-file'
import { cleanupProjectFile } from '../skills/executor'
import { extractGaps, buildGapsBlock } from '../utils/gaps-parser'

const RUN_TRIGGERS = [
  /^chạy đi$/i,
  /^chạy lại$/i,
  /^chạy$/i,
  /^ok chạy$/i,
  /^run$/i,
  /^run again$/i,
  /^re-?run$/i,
  /^go$/i,
  /^proceed$/i,
  /^done$/i,
  /^ok$/i,
  /^oke$/i,
  /^yes$/i,
  /^start$/i,
]

const SKIP_TRIGGERS = [
  /^skip$/i,
  /^no$/i,
  /^bỏ qua$/i,
  /^không$/i,
  /^nope$/i,
  /^ignore$/i,
]

export function isTrigger(text: string): boolean {
  const clean = text.replace(/<@[A-Z0-9]+>/g, '').trim()
  return RUN_TRIGGERS.some((p) => p.test(clean))
}

function isSkip(text: string): boolean {
  const clean = text.replace(/<@[A-Z0-9]+>/g, '').trim()
  return SKIP_TRIGGERS.some((p) => p.test(clean))
}

export function registerThreadReplyHandler(app: App) {
  app.message(async ({ message, client }) => {
    const msg = message as any

    if (!msg.thread_ts || msg.thread_ts === msg.ts) return
    if (msg.bot_id || msg.subtype === 'bot_message') return

    const threadTs = msg.thread_ts
    if (!hasActiveSession(threadTs)) return

    const session = getSession(threadTs)!
    const userText = (msg.text || '').replace(/<@[A-Z0-9]+>/g, '').trim()

    // Clarifying state: user can skip or add context then re-run
    if (session.status === 'clarifying') {
      if (isSkip(userText)) {
        await client.chat.postMessage({
          channel: msg.channel,
          thread_ts: threadTs,
          text: 'Got it — skipping clarification. Session closed.',
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `👍 Skipping clarification. The report above is your final output.` },
            },
          ],
        })
        updateStatus(threadTs, 'done')
        if (session.localFilePath) await cleanupFile(session.localFilePath)
        if (session.projectFilePath) await cleanupProjectFile(session.projectFilePath)
        deleteSession(threadTs)
        return
      }

      if (isTrigger(userText)) {
        await runSkill(session, client, msg.channel)
        return
      }

      // Accumulate clarification answers
      appendMessage(threadTs, userText)
      await client.chat.postMessage({
        channel: msg.channel,
        thread_ts: threadTs,
        text: `Context saved (${session.userMessages.length} total). Say "run" to re-analyze with this context, or "skip" to finish.`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✏️ Context saved. Say *"run"* to re-analyze with full context, or *"skip"* to close.`,
            },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `_${session.userMessages.length} clarification(s) queued_` }],
          },
        ],
      })
      return
    }

    // Waiting state: collect context or fire skill
    if (isTrigger(userText)) {
      await runSkill(session, client, msg.channel)
      return
    }

    appendMessage(threadTs, userText)
    await client.chat.postMessage({
      channel: msg.channel,
      thread_ts: threadTs,
      text: `Context saved (${session.userMessages.length} total). Say "run" when ready.`,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `✏️ Got it. Add more context or say *"run"* when ready.` },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `_${session.userMessages.length} context message(s) saved_` }],
        },
      ],
    })
  })
}

// ─── Shared skill runner ─────────────────────────────────────────

export async function runSkill(session: any, client: any, channelId: string) {
  updateStatus(session.threadTs, 'running')

  await client.chat.postMessage({
    channel: channelId,
    thread_ts: session.threadTs,
    text: `Running ${session.intent.label}...`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `⚙️ *Running: ${session.intent.label}*`,
            session.userMessages.length > 0
              ? `_With ${session.userMessages.length} context message(s) from thread_`
              : `_No extra context_`,
          ].join('\n'),
        },
      },
    ],
  })

  const beforeTs = Date.now()

  const result = await executeSkill(
    session.intent.slashCommand,
    session.projectFilePath,
    session.userMessages,
    undefined
  )

  let reportContent: string | null = null
  if (session.intent.reportPrefix && result.success) {
    reportContent = await waitForNewReport(session.intent.reportPrefix, beforeTs, 60_000)
  }

  if (result.success) {
    // Upload full report as file
    if (reportContent) {
      const filename = `${session.intent.reportPrefix}-report.md`
      await client.files.uploadV2({
        channel_id: channelId,
        thread_ts: session.threadTs,
        filename,
        content: reportContent,
        initial_comment: `✅ *${session.intent.label} complete.* Full report attached.`,
      })
    } else {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: session.threadTs,
        text: `✅ ${session.intent.label} complete.`,
        blocks: buildSuccessBlock(session.intent.label, truncateForSlack(result.output.trim(), 2500)),
      })
    }

    // Check for gaps → ask user if they want to clarify
    const gaps = reportContent ? extractGaps(reportContent) : []
    if (gaps.length > 0) {
      const gapsMsg = buildGapsBlock(gaps)
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: session.threadTs,
        ...gapsMsg,
      })
      updateStatus(session.threadTs, 'clarifying')
      return // keep session alive for clarification
    }
  } else {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: session.threadTs,
      text: `❌ ${session.intent.label} failed.`,
      blocks: buildErrorBlock(session.intent.label, result.error || result.output),
    })
  }

  updateStatus(session.threadTs, 'done')
  if (session.localFilePath) await cleanupFile(session.localFilePath)
  if (session.projectFilePath) await cleanupProjectFile(session.projectFilePath)
  deleteSession(session.threadTs)
}

// ─── Block builders ──────────────────────────────────────────────

function buildSuccessBlock(skillLabel: string, output: string) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `✅ ${skillLabel} — Done` },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '```' + output + '```' },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_Full report saved to \`qe-reports/\` on local machine_` }],
    },
  ]
}

function buildErrorBlock(skillLabel: string, error: string) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `❌ ${skillLabel} — Failed` },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error:*\n\`\`\`${truncateForSlack(error, 1500)}\`\`\``,
      },
    },
  ]
}
