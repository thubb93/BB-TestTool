import 'dotenv/config'
import { App } from '@slack/bolt'
import { registerMentionHandler } from './handlers/mention'
import { registerThreadReplyHandler } from './handlers/thread-reply'

// ─── Validate env ────────────────────────────────────────────────
const requiredEnv = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'PROJECT_ROOT']
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`❌ Missing env var: ${key}`)
    console.error('   Copy .env.example → .env và điền vào đầy đủ.')
    process.exit(1)
  }
}

// ─── Init Slack Bolt app (Socket Mode) ──────────────────────────
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: (process.env.LOG_LEVEL as any) || 'info',
})

// ─── Register handlers ───────────────────────────────────────────
registerMentionHandler(app)
registerThreadReplyHandler(app) // multi-turn Q&A trong thread

// ─── Start ───────────────────────────────────────────────────────
;(async () => {
  await app.start()
  console.log()
  console.log('🤖 BB-TestTool Slack Bot is running!')
  console.log(`   Project root : ${process.env.PROJECT_ROOT}`)
  console.log(`   Mode         : Socket Mode (no public URL needed)`)
  console.log()
  console.log('Đang lắng nghe Slack events...')
  console.log('Tag @bot trong channel bất kỳ để bắt đầu.')
})()
