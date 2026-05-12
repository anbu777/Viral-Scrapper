# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is

**Social Media AI** — a tool that helps create viral short-form videos (**Instagram Reels, TikTok, YouTube Shorts**) by analyzing competitor content. It scrapes competitors' recent videos, identifies the most viral ones, analyzes them with AI (video understanding + content breakdown), generates new adapted video concepts, and produces **full word-for-word personalized scripts** ready for any avatar video platform.

---

## How to Run

```bash
cd app
npm install
npm run dev
# Open http://localhost:3001
```

**Minimum (100% free) setup** — only one env var is actually required:

- `GEMINI_API_KEY` — Google Gemini 2.5 Flash (free, ~1500 req/day) — get it at https://aistudio.google.com/app/apikey

For TikTok and YouTube Shorts scraping, also install **yt-dlp** (free, open source):

- Windows: `winget install yt-dlp`
- macOS:   `brew install yt-dlp`
- Linux:   `pipx install yt-dlp`

**Optional (paid) upgrades** — everything else is purely optional. The app
gracefully falls back to free providers when these are unset:

- `ANTHROPIC_API_KEY` — Claude for higher-quality script generation (falls back to Gemini)
- `APIFY_API_TOKEN` — Apify Instagram scraper (or use SCRAPER_PROVIDER=local / manual)
- `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` — voice cloning (falls back to free Edge TTS)
- `FAL_KEY` — fal.ai for image + video generation
- `DID_API_KEY` — D-ID avatar video generation
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` — Telegram approval workflow (free)

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** components (dark theme, neon-green accent, glassmorphism)
- **SQLite** (default) or **PostgreSQL** for data storage
- **Multi-platform scraping**:
  - **Instagram**: Playwright (local, free) / Apify (paid) / manual URL import
  - **TikTok**: `yt-dlp` (free, open source)
  - **YouTube Shorts**: `yt-dlp` (free, open source)
- **Google Gemini 2.5 Flash** (FREE) — Video analysis, transcription, concepts, scripts, consistency check
- **Anthropic Claude** (optional, paid) — Higher-quality script generation
- **Microsoft Edge TTS** (FREE, default) — Text-to-speech via the `msedge-tts` npm package
- **ElevenLabs** (optional, paid) — Voice cloning when premium quality is needed
- **fal.ai / D-ID** (optional, paid) — Avatar video generation
- **Telegram Bot API** (FREE) — Human-in-the-loop approval before posting

---

## How The System Works

### Pipeline Overview

1. **Input** — Select a config and parameters (max videos, top-K, days lookback) via the Run page
2. **Load Config** — Retrieve analysis prompt, new concepts prompt, and creator list from the DB
3. **Scrape** — For each competitor creator, scrape recent short-form videos from the right platform (Instagram via Playwright/Apify/manual; TikTok and YouTube Shorts via yt-dlp)
4. **Filter & Rank** — Filter by date, sort by views, take top-K most viral
5. **Analyze** — Download video, upload to Gemini, analyze (extracts Concept, Hook, Retention, Reward, Script)
6. **Generate** — Send analysis + brand context to the AI provider (Gemini by default) for adapted concepts and scripts
7. **Save** — Persist results to SQLite/Postgres, viewable in the Videos page with thumbnails

### Multi-Platform Support

The app handles **Instagram**, **TikTok**, and **YouTube Shorts** as first-class content sources:

- Each creator has a `platform` field; the pipeline routes scraping to the matching provider.
- The `/import` page auto-detects the platform of each pasted URL and enriches TikTok/YouTube imports with `yt-dlp` (thumbnail, view count, uploader) when available.
- All downstream stages (AI analysis, ranking, script generation, TTS) are platform-agnostic.

### Two Customizable Prompts Per Config

- **Analysis Instruction** — How Gemini should break down the video
- **New Concepts Instruction** — How the AI should adapt the reference for the brand

---

## Workspace Structure

```
.
├── CLAUDE.md                              # This file
├── .env                                   # API keys (not committed)
├── .env.example                           # Documented example with free/paid notes
├── app/                                   # Next.js application
│   ├── src/
│   │   ├── app/                           # Pages and API routes
│   │   │   ├── page.tsx                   # Dashboard (redirects to /videos)
│   │   │   ├── videos/page.tsx            # Videos browser with thumbnails
│   │   │   ├── run/page.tsx               # Pipeline runner with live progress
│   │   │   ├── runs/page.tsx              # Pipeline run history
│   │   │   ├── import/page.tsx            # Multi-platform URL import (IG/TikTok/YouTube)
│   │   │   ├── configs/page.tsx           # Config management
│   │   │   ├── creators/page.tsx          # Creator management (multi-platform)
│   │   │   ├── settings/page.tsx          # Provider health checks
│   │   │   └── api/                       # API routes
│   │   ├── lib/                           # Core logic
│   │   │   ├── pipeline-runs.ts           # DB-backed pipeline orchestration
│   │   │   ├── gemini.ts                  # Gemini video analysis client
│   │   │   ├── claude.ts                  # Claude (falls back to Gemini if key empty)
│   │   │   ├── ai-providers.ts            # AI provider routing
│   │   │   ├── tts.ts                     # TTS dispatcher (Edge TTS or ElevenLabs)
│   │   │   ├── tts-free.ts                # FREE Edge TTS via msedge-tts
│   │   │   ├── platform-detect.ts         # URL → platform detection
│   │   │   ├── providers/                 # Per-platform scraper providers
│   │   │   │   ├── instagram.ts           # Shared provider interface
│   │   │   │   ├── apify-provider.ts      # Apify (Instagram, paid)
│   │   │   │   ├── local-provider.ts      # Playwright (Instagram, free)
│   │   │   │   ├── manual-provider.ts     # Manual URL import (any platform)
│   │   │   │   ├── tiktok-provider.ts     # TikTok via yt-dlp (FREE)
│   │   │   │   ├── youtube-provider.ts    # YouTube Shorts via yt-dlp (FREE)
│   │   │   │   └── ytdlp.ts               # Shared yt-dlp wrapper
│   │   │   └── types.ts                   # TypeScript interfaces
│   │   ├── db/                            # SQLite + Postgres data layer (Drizzle)
│   │   └── components/                    # UI components (shadcn + custom)
│   └── package.json
├── data/                                  # Local data (DB + CSV legacy)
├── context/                               # Background context for Claude
├── plans/                                 # Implementation plans
└── .claude/commands/                      # Slash commands (prime, create-plan, implement)
```

---

## App Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Redirects to `/videos` |
| Videos | `/videos` | Browse competitor videos with thumbnails, expandable analysis, generated concepts & scripts |
| Run Pipeline | `/run` | Select config, set params, run pipeline with live progress streaming |
| Run History | `/runs` | List of past pipeline runs with status + retry button |
| Import | `/import` | Paste Instagram / TikTok / YouTube Shorts URLs (auto-detected) |
| Configs | `/configs` | CRUD for pipeline configs (prompts, categories) |
| Creators | `/creators` | CRUD for competitor accounts across IG / TikTok / YouTube |
| Settings | `/settings` | Provider health dashboard |
| **My Scripts** | `/scripts` | Browse scripts; **Generate Video** triggers TTS → fal/D-ID → consistency → Telegram |
| **Voice Profile** | `/voice-profile` | Define content style, tone, audience, sample content + upload AI avatar image |

## Script Studio Features

- **Voice Profile** (`/voice-profile`) — Teach the AI your niche, tone, target audience, go-to phrases, and existing sample content. Saved to `data/voice-profile.json`.
- **Script Generation** — On the Videos page, every analyzed video has a "Generate My Script" button. Clicking it calls the active AI provider (Gemini by default, Claude when configured) with your Voice Profile + the video's Gemini analysis to produce a production-ready script.
- **Script Format** — Each script includes: Hook (0–3 seconds), Body scenes with visual cues, CTA, and production notes (avatar emotion, pace, background, text overlays).
- **Scripts Library** (`/scripts`) — All generated scripts are persisted in the database. Browse, star, copy, and delete scripts.

## Video Generation Pipeline

**Full flow** triggered by "Generate Video" button on Scripts page:

```
Script text → extractSpokenText() → TTS (Edge TTS free, or ElevenLabs paid) → MP3
                                                       ↓
Avatar image → fal.ai (paid) or D-ID (paid) → lip-sync video job
                                                       ↓
                              Poll provider until complete
                                                       ↓
               Consistency check (Gemini Vision + optional Claude Vision frames)
                                                       ↓
                    Telegram Bot → send video + AI verdicts + [Approve / Reject / Regen]
                                                       ↓
                              Tap button in Telegram → videoStatus updated in DB
```

**Video status values**: `idle` → `processing` → `awaiting_approval` → `approved` / `rejected` / `failed`

**Telegram webhook setup** (required for button callbacks):
- Local dev: `ngrok http 3001` → `https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://xxx.ngrok.io/api/telegram/webhook`
- Production (Vercel): set webhook to `https://your-app.vercel.app/api/telegram/webhook`

**Bundled ffmpeg**: the app uses `@ffmpeg-installer/ffmpeg` so a system-wide ffmpeg install is **not** required. yt-dlp must still be installed separately for TikTok / YouTube scraping.

---

## Commands

### /prime
Initialize a new session with full context awareness.

### /create-plan [request]
Create a detailed implementation plan in `plans/`.

### /implement [plan-path]
Execute a plan step by step.

---

## Critical Instruction: Maintain This File

After any change to the workspace, ask:
1. Does this change add new functionality?
2. Does it modify the workspace structure documented above?
3. Should a new command be listed?
4. Does context/ need updates?

If yes, update the relevant sections.

---

## Session Workflow

1. **Start**: Run `/prime` to load context
2. **Work**: Use commands or direct Claude with tasks
3. **Plan changes**: Use `/create-plan` before significant additions
4. **Execute**: Use `/implement` to execute plans
5. **Maintain**: Claude updates CLAUDE.md and context/ as the workspace evolves
