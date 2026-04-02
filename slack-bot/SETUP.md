# Setup Slack Bot

## Bước 1 — Tạo Slack App

1. Vào https://api.slack.com/apps → **Create New App** → **From scratch**
2. Đặt tên: `BB TestTool Bot`, chọn workspace của bạn

## Bước 2 — Bật Socket Mode

1. **Settings → Socket Mode** → Enable Socket Mode
2. Generate App-Level Token:
   - Token Name: `bot-token`
   - Scope: `connections:write`
   - Copy token (bắt đầu bằng `xapp-...`) → dùng cho `SLACK_APP_TOKEN`

## Bước 3 — Thêm Bot Scopes

1. **OAuth & Permissions → Scopes → Bot Token Scopes**, thêm:
   - `app_mentions:read` — nhận event khi bị @mention
   - `chat:write` — gửi message
   - `files:read` — download file đính kèm
   - `channels:history` — đọc thread context

2. **Install App to Workspace** → Copy **Bot User OAuth Token** (`xoxb-...`) → dùng cho `SLACK_BOT_TOKEN`

## Bước 4 — Bật Event Subscriptions

1. **Event Subscriptions** → Enable
2. **Subscribe to bot events**, thêm:
   - `app_mention`

## Bước 5 — Config local

```bash
cd slack-bot
cp .env.example .env
# Điền SLACK_BOT_TOKEN và SLACK_APP_TOKEN vào .env
```

## Bước 6 — Cài dependencies và chạy

```bash
cd slack-bot
npm install
npm run dev
```

Output mong đợi:
```
🤖 BB-TestTool Slack Bot is running!
   Project root : /Users/arrthur/Project/BB-TestTool
   Mode         : Socket Mode (no public URL needed)

Đang lắng nghe Slack events...
```

## Cách dùng

Mời bot vào channel: `/invite @BB TestTool Bot`

Sau đó tag bot:
```
@bot phân tích requirement
```
Kèm file `spec.md` → Bot sẽ chạy `/qe:analyze-req` và reply kết quả vào thread.

## Các lệnh hỗ trợ

| Nói gì | Skill chạy |
|--------|-----------|
| `phân tích requirement` + file | `/qe:analyze-req` |
| `tạo test plan` + file | `/qe:test-plan` |
| `tạo test case` + file | `/qe:test-case` |
| `chạy e2e` | `/qe:e2e` |
| `security scan` | `/qe:security` |
| `báo cáo` / `report` | `/qe:report` |
