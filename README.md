# Social Media AI — Viral Reels Pipeline

> Scrape competitor **Instagram Reels, TikTok, and YouTube Shorts** → analyze with AI → generate word-for-word personalized scripts → optionally produce an avatar lip-sync video → ship it.

Designed to run **100% free** out of the box (Gemini + Edge TTS + manual import or `yt-dlp`), with optional drop-in upgrades to paid APIs (Claude, ElevenLabs, Apify, fal.ai, D-ID).

---

## Table of contents

1. [What you get](#what-you-get)
2. [Tech stack](#tech-stack)
3. [Quick start (5 minutes, fully free)](#quick-start-5-minutes-fully-free)
4. [Full setup — every API explained](#full-setup--every-api-explained)
5. [Choosing a scraper provider](#choosing-a-scraper-provider)
6. [Running the app](#running-the-app)
7. [Optional upgrades](#optional-upgrades)
8. [Telegram approval bot (optional)](#telegram-approval-bot-optional)
9. [Database options](#database-options)
10. [Troubleshooting](#troubleshooting)
11. [Project layout](#project-layout)

---

## What you get

| Page | Path | Purpose |
| --- | --- | --- |
| Dashboard | `/` | Recent runs + summary stats |
| Run pipeline | `/run` | Pick a config + creators, run with live streaming progress |
| Videos | `/videos` | Browse analyzed competitor videos with thumbnails + full Gemini breakdown |
| Scripts | `/scripts` | All generated scripts + one-click "Generate Video" pipeline |
| Configs | `/configs` | CRUD analysis & concept prompts per niche |
| Creators | `/creators` | Manage competitor handles across Instagram / TikTok / YouTube Shorts |
| Voice profile | `/voice-profile` | Teach the AI your tone, niche, audience + upload your avatar image |
| Prompt library | `/prompt-library` | Reusable prompt templates |
| Import | `/import` | Paste raw IG / TikTok / Shorts URLs and the app figures the rest out |
| Avatars | `/avatars` | Manage AI avatar identities |

---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** with a glassmorphism, neon-green-on-black theme
- **SQLite** locally (or optional Postgres via `DATABASE_URL`)
- **Google Gemini 2.5 Flash** — video analysis, transcripts, concepts, scripts, consistency check *(free tier covers everything)*
- **Microsoft Edge TTS** via `msedge-tts` — free neural voices, 400+ options, no signup
- **yt-dlp** — free TikTok & YouTube Shorts scraping & download
- **Playwright** — optional headless Instagram scraping
- Optional paid providers: **Apify**, **Anthropic Claude**, **ElevenLabs**, **fal.ai**, **D-ID**, **Telegram Bot API** (free)

---

## Quick start (5 minutes, fully free)

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/social-media-ai.git
cd social-media-ai

# 2. Install yt-dlp (required for TikTok / Shorts; optional for IG-only)
#   Windows:
winget install yt-dlp
#   macOS:
brew install yt-dlp
#   Linux:
pipx install yt-dlp

# 3. Copy the env template
cp .env.example .env

# 4. Open .env and set exactly ONE key:
#       GEMINI_API_KEY=<your-key>
#   Free key in 60 seconds: https://aistudio.google.com/app/apikey

# 5. Install Node deps and start
cd app
npm install
npm run dev
```

Open <http://localhost:3001>. You're ready to:

- Add creators on `/creators` (pick the platform: IG / TikTok / YouTube Shorts)
- Or paste URLs directly on `/import`
- Run the pipeline on `/run`

That's it. No paid services required.

---

## Full setup — every API explained

The `.env.example` at the repo root documents every variable. Below is the human-readable version.

### Required for the free baseline

| Variable | What it does | Where to get it | Cost |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Video analysis, transcripts, concept & script generation, consistency check | <https://aistudio.google.com/app/apikey> | **Free** — ~1500 req/day |

That single key unlocks the entire pipeline.

### Choose how to ingest videos

`SCRAPER_PROVIDER` controls how Reels/Shorts/TikToks are fetched. Pick one based on your situation:

| Value | What it does | API key needed? |
| --- | --- | --- |
| `manual` *(default)* | You paste URLs on `/import`; the app fetches metadata via Gemini / yt-dlp | None |
| `apify` | Uses Apify's Instagram scraper for bulk extraction | `APIFY_API_TOKEN` — freemium, ~$5/mo free credits |
| `local` | Scrapes Instagram via headless Playwright (you'll likely need a logged-in browser profile in `LOCAL_BROWSER_PROFILE_DIR`) | None |
| `tiktok` | TikTok via `yt-dlp` | None — just install `yt-dlp` |
| `youtube` | YouTube Shorts via `yt-dlp` | None — just install `yt-dlp` |

> You can also mix-and-match per creator: set the **platform** when adding the creator on `/creators` and the pipeline will route to the right provider automatically.

### Optional paid upgrades

All of these are **fully optional**. If the key is empty the app silently falls back to the free path.

| Variable | What it upgrades | Free fallback | Where |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Higher-quality script + concept generation via Claude Sonnet | Gemini | <https://console.anthropic.com/> |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | Studio-grade voice cloning | Edge TTS (free) | <https://elevenlabs.io/> |
| `FAL_KEY` | fal.ai image / avatar video generation | Avatar video skipped | <https://fal.ai/> |
| `DID_API_KEY` | D-ID avatar lip-sync video | Avatar video skipped | <https://www.d-id.com/> |
| `APIFY_API_TOKEN` | Apify Instagram scraper | `manual` / `local` providers | <https://console.apify.com/account/integrations> |

### Always-free optional add-ons

| Variable | What it does | Cost |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` + `TELEGRAM_WEBHOOK_SECRET` | Human-in-the-loop approval for generated videos | **Free** — Telegram Bot API |
| `TTS_FREE_VOICE` | Override the Edge TTS voice (e.g. `id-ID-GadisNeural`, `en-US-GuyNeural`) | **Free** |
| `OLLAMA_BASE_URL` + `OLLAMA_MODEL` | Run local LLMs instead of cloud | **Free** (requires local install) |
| `WHISPER_COMMAND` | Local Whisper transcript | **Free** (CPU-heavy) |

---

## Choosing a scraper provider

```
┌───────────────────────────────────────────────────────────┐
│  Pick the smallest path that fits your goal.              │
├───────────────────────────────────────────────────────────┤
│  Just want to test → manual. Paste 1-2 URLs on /import.   │
│  TikTok focus     → tiktok. Install yt-dlp, done.         │
│  YouTube Shorts   → youtube. Install yt-dlp, done.        │
│  Bulk Instagram   → apify (recommended) or local.         │
└───────────────────────────────────────────────────────────┘
```

The `/import` page auto-detects the platform from any URL you paste, so you can use a single workflow across all three platforms without switching providers.

---

## Running the app

```bash
cd app
npm install
npm run dev          # http://localhost:3001
npm run build        # production build
npm run start        # serve production build
npm run lint
npm run typecheck    # tsc --noEmit
npm test             # vitest
```

The dev server defaults to **port 3001** (see `app/package.json` → `"dev": "next dev -p 3001"`). Adjust `APP_BASE_URL` in `.env` if you change the port.

---

## Optional upgrades

### Add Claude for higher-quality scripts

```env
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=claude
```

If the key is missing the app automatically routes back to Gemini — no errors, no config branches.

### Add ElevenLabs voice cloning

```env
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=<voice-id>
```

When empty, the app uses Microsoft Edge TTS (also free, no signup).

### Add avatar video generation

Pick one:

```env
# Option A — fal.ai (recommended)
VIDEO_PROVIDER=fal
FAL_KEY=...

# Option B — D-ID
DID_API_KEY=...
```

Leave `VIDEO_PROVIDER=none` to skip the avatar stage entirely.

---

## Telegram approval bot (optional)

1. Talk to [@BotFather](https://t.me/BotFather) → `/newbot` → grab the token.
2. Talk to [@userinfobot](https://t.me/userinfobot) → grab your chat ID.
3. Add to `.env`:

   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_CHAT_ID=123456789
   TELEGRAM_WEBHOOK_SECRET=<random-string>
   APP_BASE_URL=https://your-public-https-url
   ```

4. Expose your dev server (for local testing):

   ```bash
   ngrok http 3001
   # or
   cloudflared tunnel --url http://localhost:3001
   ```

5. Register the webhook:

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_BASE_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

The Telegram bot is **100% free** — there is no paid tier.

---

## Database options

The app ships with **SQLite** by default (`data/app.db`, ignored by git). To use Postgres (e.g. Supabase free tier), set:

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Then run migrations:

```bash
cd app
npm run db:migrate         # SQLite
npm run db:migrate:pg      # Postgres
```

To seed from the bundled CSVs:

```bash
npm run db:migrate-csv     # imports data/configs.csv, creators.csv, etc.
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `yt-dlp: command not found` | Install it (see [Quick start](#quick-start-5-minutes-fully-free)). Override the binary path with `YTDLP_COMMAND` if needed. |
| Instagram thumbnails missing | Instagram CDN URLs expire quickly. The app proxies them via `/api/proxy-image`. If they still fail, re-scrape. |
| `EADDRINUSE :::3001` | The dev server is already running in another terminal. Kill it or change the port. |
| `ANTHROPIC_API_KEY` not set warnings | Safe to ignore — Claude is optional and Gemini handles everything. |
| "Telegram webhook 401" | Make sure `TELEGRAM_WEBHOOK_SECRET` matches what you used in `setWebhook`. |
| Slow video analysis | Gemini free tier rate-limits at ~1500 req/day. Add `ANTHROPIC_API_KEY` to spread load, or upgrade Gemini. |

---

## Project layout

```
.
├── README.md                # This file
├── CLAUDE.md                # Claude Code session guidance
├── .env.example             # Documented env template
├── app/                     # Next.js application (root of npm scripts)
│   ├── src/
│   │   ├── app/             # Pages + API routes (App Router)
│   │   ├── components/      # UI components (shadcn + custom)
│   │   ├── lib/             # Pipeline, providers, AI clients, types, utils
│   │   │   └── providers/   # Instagram / TikTok / YouTube scrapers
│   │   ├── db/              # SQLite + Postgres schemas & migrations
│   │   └── scripts/         # One-off scripts (CSV → DB migration, etc.)
│   ├── drizzle.config.ts
│   └── package.json
├── data/                    # Local data (most files gitignored)
│   ├── configs.csv          # Bundled sample configs
│   ├── creators.csv         # Bundled sample creators
│   ├── prompt-library.json  # Bundled sample prompts
│   └── app.db               # SQLite database (gitignored)
├── context/                 # Background docs for Claude
└── plans/                   # Implementation plans
```

---

## License

MIT. See [LICENSE](./LICENSE) if included.

Built with ❤ for creators who want to ship faster.
