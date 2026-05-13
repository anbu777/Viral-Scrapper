<div align="center">

# ⚡ Virality System

### Social Media Intelligence Platform for Viral Content Creation

**Reverse-engineer viral short-form content on Instagram, TikTok, and YouTube Shorts — then generate your own.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=flat-square)](https://orm.drizzle.team/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#license)

</div>

---

## 🎯 What is this?

**Virality System** is an end-to-end intelligence platform that scrapes competitor short-form content across **Instagram Reels**, **TikTok**, and **YouTube Shorts**, analyzes what makes it viral with AI, and generates production-ready scripts and avatar videos adapted for *your* brand.

Think of it as a **viral content reverse-engineering studio** — you point it at competitors, and it gives you trends, hooks, formats, and word-for-word scripts ready to be turned into AI avatar videos.

> _Built for short-form content creators, brands, and agencies who want to systematize the process of identifying what's working in their niche and shipping content that resonates._

---

## ✨ Highlights

### 🧠 Intelligence
- **Multi-Platform Scraping** — Instagram (Apify / Playwright), TikTok (Apify / yt-dlp), YouTube Shorts (Data API v3 / yt-dlp)
- **AI Video Analysis** — Gemini 2.5 Flash decomposes every viral video into hook, retention, format, audience, and viral mechanics
- **Auto-Scheduler** — Cron-style polling per creator with viral threshold detection
- **Viral Alerts** — Real-time notifications when tracked creators post breakout content (Telegram + Discord + Email)
- **Trends Dashboard** — Charts of views over time, top creators, format patterns, posting heatmap, viral hook patterns
- **Intelligence Reports** — Auto-generated weekly reports with recommendations, exportable as Markdown
- **Niche Discovery** — Find creators by keyword across your scraped database

### ✍️ Studio
- **Word-for-Word Script Generation** — Gemini / Claude generates complete scripts (hook, body, CTA, production notes) styled to your voice profile
- **A/B Hook Variations** — Auto-generate 3-5 hook style variants per script (question, shock, story, list, contrarian)
- **Voice Profile** — Define your niche, tone, audience, signature phrases for consistent script output
- **Avatar Library** — Define multiple AI personas with reference images and ElevenLabs voice IDs
- **Video Pipeline** — Edge TTS or ElevenLabs → fal.ai (Kling 3.0) or D-ID → Gemini Vision consistency check → Telegram approval workflow
- **Content Calendar** — Plan, schedule, and track posting status (draft / recorded / posted / cancelled)
- **Performance Tracker** — Log actual post URLs and 24h/48h/7d metrics for prediction calibration

### 🎨 UX
- **Premium Dark UI** — Glassmorphism, neon-green accent, smooth page transitions, custom thin scrollbars
- **Loading Screen** — Animated splash on first load (sessionStorage-gated)
- **Toast System** — Non-blocking feedback for all CRUD actions
- **Pre-flight Validation** — Pipeline runs validate config-creator alignment before starting
- **Provider Health Dashboard** — At-a-glance status of every API key

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Web Dashboard (Next.js)                      │
│  Dashboard · Videos · Trends · Reports · Discover · Calendar · ...  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
        ┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼────────┐
        │  Pipeline      │  │  Scheduler     │  │  Studio       │
        │  Orchestrator  │  │  (auto-tick)   │  │  (TTS+Video)  │
        └───────┬────────┘  └───────┬────────┘  └──────┬────────┘
                │                   │                   │
        ┌───────▼────────────────────▼─────────┐       │
        │       Provider Layer (settings-driven)│       │
        │  Apify · Playwright · yt-dlp · YT API │       │
        └───────────────────┬──────────────────┘       │
                            │                          │
        ┌───────────────────▼──────────────────────────▼──────┐
        │  AI Layer: Gemini · Claude · fal.ai · D-ID · TTS    │
        └────────────────────────┬─────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   SQLite (default) or   │
                    │   PostgreSQL (Drizzle)  │
                    │   19 tables, migrated   │
                    │   incrementally         │
                    └─────────────────────────┘
```

### Pipeline Flow

```
1. Select Config + Params      →  /run page validates pre-flight
2. Resolve Provider per-platform  → DB settings (or env fallback)
3. Scrape Top-K viral videos   →  Filter by date + sort by views
4. Analyze with Gemini 2.5     →  Hook, retention, format, audience
5. Score & Rank                →  Virality formula (views, engagement, recency)
6. Generate Scripts            →  Voice profile + analysis → word-for-word
7. (Optional) Generate Video   →  TTS → fal.ai/D-ID → consistency check
8. Telegram Approval           →  Webhook callbacks → DB status update
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- (Optional) `yt-dlp` for TikTok / YouTube fallback scraping

### Setup
```bash
git clone https://github.com/anbu777/Viral-Scrapper.git
cd Viral-Scrapper/app
npm install

# Set the only required key
cp .env.example .env
# Edit .env → GEMINI_API_KEY=your_key_here   (free at https://aistudio.google.com)

npm run dev
# → http://localhost:3001
```

### Optional integrations
Configure these from the **Settings** page (no `.env` editing needed):

| Provider | Purpose | Free / Paid |
|---|---|---|
| **Apify** | Reliable scraping for IG + TikTok | Paid (~$0.001/req) |
| **YouTube Data API v3** | Native YouTube Shorts metadata | Free (10k req/day) |
| **Anthropic Claude** | Higher-quality script generation | Paid |
| **ElevenLabs** | Voice cloning | Paid |
| **fal.ai** | Kling 3.0 avatar video | Paid |
| **D-ID** | Talking-head avatars | Paid |
| **Telegram Bot** | Approval workflow | Free |
| **Discord / Resend** | Alert notifications | Free / Free tier |

> All optional integrations are toggleable from the dashboard. Without them, the app gracefully falls back to free tiers (Gemini + Edge TTS + yt-dlp).

---

## 🗂️ Application Map

### 🧠 Intelligence
| Page | Path | Purpose |
|---|---|---|
| **Dashboard** | `/` | Setup status, warnings, top viral, intelligence shortcuts |
| **Videos** | `/videos` | Browse scraped reels with thumbnails, AI analysis, generated concepts |
| **Viral Alerts** | `/viral-alerts` | Auto-detected breakout content from tracked creators |
| **Trends** | `/trends` | Charts: views over time, top creators, format patterns, heatmap |
| **Reports** | `/reports` | Generate weekly intelligence reports (export Markdown) |
| **Discover** | `/discover` | Find creators by keyword across scraped database |

### 🚀 Pipeline
| Page | Path | Purpose |
|---|---|---|
| **Run** | `/run` | Launch pipeline with live progress streaming |
| **Run History** | `/runs` | Past runs with retry button, error details |
| **Manual Import** | `/import` | Paste IG/TikTok/YouTube URLs (auto-detected) |

### 🛠️ Setup
| Page | Path | Purpose |
|---|---|---|
| **Creators** | `/creators` | CRUD across IG/TikTok/YT, grouped folder view, alias mapping |
| **Configs** | `/configs` | CRUD pipeline configs with prompt template selector |

### 🎬 Studio
| Page | Path | Purpose |
|---|---|---|
| **Scripts** | `/scripts` | Browse generated scripts, generate variations (A/B), trigger video gen |
| **Calendar** | `/calendar` | Plan content with month-grid view, link to scripts |
| **Performance** | `/performance` | Track posted content with 24h/48h/7d metrics |
| **Generated** | `/generated` | Browse rendered avatar videos |
| **Avatars** | `/avatars` | AI persona library with reference images + voice IDs |
| **Voice Profile** | `/voice-profile` | Brand voice settings (niche, tone, signature phrases) |
| **Prompt Library** | `/prompt-library` | Reusable image + video prompt templates |

### ⚙️ System
| Page | Path | Purpose |
|---|---|---|
| **Settings** | `/settings` | Provider keys, scheduler config, notification webhooks |

---

## 📡 API Reference

All APIs return JSON. Auth not enforced (intended for self-hosting).

| Route | Method | Purpose |
|---|---|---|
| `/api/dashboard` | GET | Aggregated stats + provider health + warnings |
| `/api/analytics?period=7d\|30d\|90d` | GET | Charts data (views over time, top creators, formats) |
| `/api/reports` | GET / POST / DELETE | List, generate, delete intelligence reports |
| `/api/reports/[id]?format=markdown` | GET | Get report (JSON or markdown export) |
| `/api/discover` | GET / POST | Niche keyword discovery |
| `/api/calendar` | GET / POST / PATCH / DELETE | Content calendar CRUD |
| `/api/performance` | GET / POST / PATCH / DELETE | Posted content tracker |
| `/api/scheduler` | GET / POST | Scheduler status + tick |
| `/api/scheduler/alerts` | GET / PATCH / POST | Viral alerts list + actions |
| `/api/scheduler/tick` | POST | Manual scheduler trigger |
| `/api/settings/providers` | GET / POST | Provider keys (masked on read) |
| `/api/settings/test` | POST | Test provider connection |
| `/api/pipeline/runs` | GET / POST | Pipeline run management |
| `/api/pipeline/validate` | POST | Pre-flight config validation |
| `/api/scripts/[id]/variations` | GET / POST | Script hook variations (A/B) |
| `/api/scripts/[id]/generate-video` | POST | Trigger video generation |
| `/api/creators` | GET / POST / PATCH / DELETE | Creator CRUD |
| `/api/creator-groups` | GET / POST / PUT / DELETE | Cross-platform creator grouping |
| `/api/creators/refresh` | POST | Refresh creator stats from provider |
| `/api/configs` | GET / POST / PATCH / DELETE | Pipeline config CRUD |
| `/api/videos` | GET / DELETE | Video CRUD |
| `/api/videos/[id]/analysis` | POST | Run AI analysis on a video |
| `/api/videos/[id]/transcript` | POST | Generate word-for-word transcript |
| `/api/scripts` | GET / PATCH / DELETE | Script CRUD |
| `/api/scripts/generate` | POST | Generate script from analyzed video |
| `/api/import/instagram-urls` | POST | Manual URL import (auto-detects platform) |
| `/api/voice-profile` | GET / POST | Brand voice profile |
| `/api/avatars` | GET / POST / PATCH / DELETE | Avatar profile CRUD |
| `/api/telegram/webhook` | POST | Telegram approval callback |

---

## 🗄️ Database

**Default**: SQLite at `data/app.db` (zero-config, perfect for local).
**Optional**: PostgreSQL via `DATABASE_URL` env (Drizzle handles both transparently).

### Tables (19 total)
```
─── Core ───────────────────────────────
creators              configs            scrape_runs
videos                scrape_run_items   analysis_runs
scripts               avatars            generation_jobs

─── Operations ─────────────────────────
provider_logs         quality_scores     app_settings

─── Multi-Platform Grouping ────────────
creator_groups

─── Auto-Scheduler ─────────────────────
scheduler_jobs        viral_alerts       scheduler_runs

─── Phase 3 Intelligence ───────────────
content_calendar      posted_content     intelligence_reports
```

Migrations are **incremental** (`ALTER TABLE` on boot), so upgrading existing installs never loses data.

---

## 🛡️ Provider Strategy (Resilient by Design)

Every external integration has a **fallback chain**:

```
Instagram   →  Apify      →  Playwright  →  Manual URL import
TikTok      →  Apify      →  yt-dlp      →  Manual URL import
YouTube     →  Data API   →  yt-dlp      →  Manual URL import

Video DL    →  Provider URL  →  URL refresh  →  yt-dlp direct
AI Analysis →  Gemini Flash  →  Metadata-only fallback
Script Gen  →  Claude (paid) →  Gemini (free)
TTS         →  ElevenLabs    →  Microsoft Edge TTS (free)
Notify      →  Telegram      →  Discord      →  Email (Resend)
```

If a paid provider isn't configured, the app silently falls back to the free path. **No hard failures from missing keys.**

---

## 🧪 Verification

```bash
cd app
npm run typecheck   # 0 errors expected
npm run test        # 9/9 passing
npm run build       # All routes register, production-ready
npx tsx e2e-verify.ts   # Inspects DB integrity end-to-end
```

### Live API Smoke
```bash
# Once dev server is running on :3001
curl http://localhost:3001/api/dashboard | jq .stats
curl http://localhost:3001/api/analytics?period=30d | jq .summary
curl -X POST http://localhost:3001/api/reports \
     -H "Content-Type: application/json" \
     -d '{"daysBack":7}' | jq .report.recommendations
```

---

## 📂 Project Layout

```
viral-ig-scraper/
├── app/                          # Next.js application root
│   ├── src/
│   │   ├── app/                  # Pages + API routes (App Router)
│   │   │   ├── api/              # 40+ API endpoints
│   │   │   ├── trends/           # Charts dashboard
│   │   │   ├── reports/          # Intelligence reports
│   │   │   ├── discover/         # Niche discovery
│   │   │   ├── calendar/         # Content calendar
│   │   │   ├── performance/      # Performance tracker
│   │   │   ├── viral-alerts/     # Viral alerts
│   │   │   └── ...               # Other pages
│   │   ├── components/           # Sidebar, top-bar, toast, loading-screen
│   │   ├── db/                   # Schema + migrations + repositories
│   │   ├── hooks/                # use-toast, etc.
│   │   └── lib/                  # Core libraries
│   │       ├── pipeline-runs.ts        # Pipeline orchestrator
│   │       ├── scheduler.ts            # Auto-scheduler tick logic
│   │       ├── viral-detector.ts       # Viral threshold detection
│   │       ├── report-generator.ts     # Weekly reports
│   │       ├── script-variations.ts    # A/B hook variation gen
│   │       ├── niche-discovery.ts      # Creator discovery
│   │       ├── creator-grouping.ts     # Cross-platform mapping
│   │       ├── notifications.ts        # Telegram + Discord + Email
│   │       ├── app-settings.ts         # DB-backed provider config
│   │       └── providers/              # Per-platform scrapers
│   └── package.json
├── data/                         # SQLite DB + thumbnails (local)
├── plans/                        # Master implementation plans
└── README.md                     # You are here
```

---

## 🎓 How It Compares

| Feature | Manual Browse | Generic Scrapers | **Virality System** |
|---|---|---|---|
| Multi-platform | Manual switching | Single platform | ✅ IG + TikTok + YT in one place |
| Viral ranking | Eye-balling | Sort by views | ✅ Engagement+recency+velocity formula |
| AI breakdown | None | Caption only | ✅ Hook, retention, format, audience |
| Script generation | Copy/paste | None | ✅ Word-for-word with voice profile |
| A/B variations | None | None | ✅ 5 hook styles per script |
| Auto-scheduler | None | Cron scripts | ✅ Built-in with viral alerts |
| Reports | None | None | ✅ Weekly intel with recommendations |
| Self-hosted | N/A | Often SaaS | ✅ Local-first, no vendor lock |

---

## 🔮 Roadmap

- [ ] Multi-account / multi-brand mode
- [ ] PDF export for intelligence reports
- [ ] Drag-and-drop calendar planner
- [ ] Auto-fetch posted content metrics via yt-dlp
- [ ] In-app analytics for script performance correlation
- [ ] Browser extension for one-click "track this creator"
- [ ] Mobile-friendly pages (currently desktop-first)

---

## 📜 License

MIT — use freely for personal or commercial projects.

---

## 🙏 Credits

Built on top of incredible open source:
- [Next.js 16](https://nextjs.org/) · [React 19](https://react.dev/) · [Tailwind 4](https://tailwindcss.com/)
- [Drizzle ORM](https://orm.drizzle.team/) · [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Recharts](https://recharts.org/) · [shadcn/ui](https://ui.shadcn.com/) · [lucide-react](https://lucide.dev/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) · [Playwright](https://playwright.dev/)
- AI providers: [Google Gemini](https://aistudio.google.com), [Anthropic Claude](https://claude.ai), [fal.ai](https://fal.ai), [D-ID](https://d-id.com), [ElevenLabs](https://elevenlabs.io)

---

<div align="center">

**Made for creators who want to ship viral content systematically, not by luck.**

⭐ Star this repo if you find it useful!

</div>
