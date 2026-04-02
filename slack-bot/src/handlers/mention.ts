import type { App } from '@slack/bolt'
import { detectIntent, getHelpText } from '../skills/router'
import { createSession, getSession, appendMessage, hasActiveSession } from '../store/session'
import { downloadSlackFile } from '../utils/slack-file'
import { copyFileToProject } from '../skills/executor'
import { isTrigger, runSkill } from './thread-reply'

export function registerMentionHandler(app: App) {
  app.event('app_mention', async ({ event, client, say }) => {
    const { text, thread_ts, ts, files } = event as any
    const threadTs = thread_ts || ts

    console.log(`[mention] Received: "${text}" | thread: ${threadTs}`)

    const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim()

    // ── Active session exists: handle as context or trigger ────────
    if (hasActiveSession(threadTs)) {
      const session = getSession(threadTs)!

      if (isTrigger(cleanText)) {
        await runSkill(session, client, event.channel)
      } else {
        appendMessage(threadTs, cleanText)
        await say({
          thread_ts: threadTs,
          text: `Got it (${session.userMessages.length} context message saved). Say "run" when ready.`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✏️ Context saved. Add more or say *"run"* when ready.`,
              },
            },
            {
              type: 'context',
              elements: [{ type: 'mrkdwn', text: `_${session.userMessages.length} context message(s) queued_` }],
            },
          ],
        })
      }
      return
    }

    // ── No session: detect intent ──────────────────────────────────
    const intent = detectIntent(text)

    if (intent.skill === 'unknown' && isTrigger(cleanText)) {
      await say({
        thread_ts: threadTs,
        text: 'No active request in this thread. Start by tagging me with a skill and a file.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `💬 *No active request in this thread.*\n\nStart a new one:\n> _@bot analyze requirement_ + attach spec.md`,
            },
          },
        ],
      })
      return
    }

    if (intent.skill === 'unknown') {
      await say({
        thread_ts: threadTs,
        text: "I didn't understand that. Here's what I can do.",
        blocks: buildUnknownBlock(getHelpText()),
      })
      return
    }

    // ── Download file if attached ──────────────────────────────────
    let localFilePath: string | null = null
    let projectFilePath: string | null = null

    if (files && files.length > 0) {
      const file = files[0]
      const botToken = process.env.SLACK_BOT_TOKEN!

      try {
        localFilePath = await downloadSlackFile(file, botToken)
        projectFilePath = await copyFileToProject(localFilePath, file.name)
        console.log(`[mention] File ready at: ${projectFilePath}`)
      } catch (err) {
        console.error('[mention] File download error:', err)
        await say({
          thread_ts: threadTs,
          text: `❌ Failed to download attachment: ${(err as Error).message}`,
        })
        return
      }
    }

    // ── Create session ─────────────────────────────────────────────
    const session = createSession({
      threadTs,
      channelId: event.channel,
      intent,
      localFilePath,
      projectFilePath,
    })

    // ── If file attached → run immediately, no "chạy đi" needed ───
    if (projectFilePath) {
      await say({
        thread_ts: threadTs,
        text: `📎 File received. Running ${intent.label}...`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📎 *File received.* Running \`${intent.slashCommand}\` now...`,
            },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `_${intent.description}_` }],
          },
        ],
      })
      await runSkill(session, client, event.channel)
      return
    }

    // ── No file → wait for user to provide more context ───────────
    await say({
      thread_ts: threadTs,
      text: `${intent.label} ready. Attach a file or add context, then say "run".`,
      blocks: buildWaitingBlock(intent),
    })
  })
}

// ─── Block builders ──────────────────────────────────────────────

function buildWaitingBlock(intent: ReturnType<typeof detectIntent>) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🎯 ${intent.label}` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `⚠️ No file attached.`,
          ``,
          `Reply in this thread with a spec file or extra context, then say *"run"* to start.`,
        ].join('\n'),
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `_Skill: \`${intent.slashCommand}\` · ${intent.description}_` },
      ],
    },
  ]
}

function buildUnknownBlock(helpText: string) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🤔 *I didn't understand that.*\n\nHere's what I can do:\n\n${helpText}`,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: '_Tip: @bot analyze requirement + attach spec.md_' },
      ],
    },
  ]
}
