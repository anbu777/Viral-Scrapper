# MASTER IMPLEMENTATION PLAN — Phase 1: Foundation & UX Overhaul

## Overview
Phase 1 fokus pada tiga hal: (1) memperbaiki semua bug yang masih ada, (2) merombak UX/UI agar user-friendly, dan (3) memindahkan semua konfigurasi provider ke database sehingga bisa diatur dari dashboard.

---

## EPIC 1: Settings & Provider Configuration Dashboard

### Tujuan
User bisa mengatur semua API keys, provider choices, dan schedule langsung dari UI tanpa menyentuh `.env`.

### Database Changes

**Tabel baru: `app_settings`** (sudah ada di schema, perlu diisi)
```sql
key: "providers"
value_json: {
  scraping: {
    instagram: { provider: "apify", apiKey: "***", enabled: true },
    tiktok: { provider: "apify_tiktok", apiKey: "***", enabled: true },
    youtube: { provider: "youtube_api", apiKey: "***", enabled: true }
  },
  ai: {
    analysis: { provider: "gemini", apiKey: "***", model: "gemini-2.5-flash" },
    scriptGen: { provider: "claude", apiKey: "***", model: "claude-sonnet-4-5" },
    transcript: { provider: "gemini", apiKey: "***" }
  },
  tts: {
    provider: "edge_tts",
    voice: "en-US-AriaNeural",
    elevenLabsApiKey: "",
    elevenLabsVoiceId: ""
  },
  video: {
    provider: "fal",
    falKey: "",
    didApiKey: "",
    model: "kling3"
  },
  notifications: {
    telegram: { botToken: "", chatId: "", webhookSecret: "", enabled: false },
    discord: { webhookUrl: "", enabled: false },
    email: { resendApiKey: "", fromEmail: "", toEmail: "", enabled: false }
  }
}
```

### Files to Create/Modify

**1. `app/src/lib/app-settings.ts`** (NEW)
- `getProviderSettings()` — baca dari DB, fallback ke env vars
- `saveProviderSettings(settings)` — simpan ke DB
- `getEffectiveScraperProvider(platform)` — resolve provider aktif per platform
- `getEffectiveAiProvider(task)` — resolve AI provider per task

**2. `app/src/app/api/settings/providers/route.ts`** (NEW)
- `GET` — return current provider settings (mask API keys)
- `POST` — save provider settings
- `POST /test` — test connection untuk provider tertentu

**3. `app/src/app/settings/page.tsx`** (REWRITE)
- Tabs: Scraping | AI | TTS | Video | Notifications | Schedule
- Per provider: dropdown pilih provider, input API key (masked), tombol "Test Connection"
- Status indicator: ✅ Connected / ❌ Error / ⚠ Not configured
- Save button dengan toast notification

**4. Update `pipeline-runs.ts`**
- Ganti `getEnv()` dengan `getProviderSettings()` untuk semua provider resolution
- Fallback chain: DB settings → env vars → default

### UI Design
```
Settings Page
├── Tab: Scraping Providers
│   ├── Instagram Section
│   │   ├── Provider: [Apify ▼] [Playwright ▼] [Manual ▼]
│   │   ├── API Key: [••••••••] [Show] [Test ✓]
│   │   └── Status: ✅ Connected — 1,247 credits remaining
│   ├── TikTok Section
│   │   ├── Provider: [Apify TikTok ▼] [yt-dlp ▼]
│   │   ├── API Key: [••••••••] [Show] [Test ✓]
│   │   └── Status: ✅ Connected
│   └── YouTube Section
│       ├── Provider: [YouTube API v3 ▼] [yt-dlp ▼]
│       ├── API Key: [••••••••] [Show] [Test ✓]
│       └── Status: ✅ Connected — 9,847/10,000 daily quota
│
├── Tab: AI Providers
│   ├── Video Analysis: [Gemini 2.5 Flash ▼] [API Key] [Test]
│   ├── Script Generation: [Claude Sonnet ▼] [API Key] [Test]
│   └── Transcription: [Gemini ▼] [Whisper Local ▼]
│
├── Tab: TTS
│   ├── Provider: [Edge TTS (Free) ▼] [ElevenLabs ▼] [OpenAI TTS ▼]
│   ├── Voice: [en-US-AriaNeural ▼] (dropdown 400+ voices)
│   └── Preview: [▶ Play sample]
│
├── Tab: Video Generation
│   ├── Provider: [fal.ai ▼] [D-ID ▼] [None ▼]
│   ├── Model: [Kling 3.0 ▼] [Kling 2.0 ▼]
│   └── API Key: [••••••••] [Test]
│
├── Tab: Notifications
│   ├── Telegram: [Toggle] Bot Token + Chat ID + Test
│   ├── Discord: [Toggle] Webhook URL + Test
│   └── Email: [Toggle] Resend API Key + From + To + Test
│
└── Tab: Auto-Scraping Schedule
    ├── Instagram: [Every 6h ▼] Max [10 ▼] videos | [Enable ▼]
    ├── TikTok: [Every 2h ▼] Max [10 ▼] videos | [Enable ▼]
    └── YouTube: [Every 2h ▼] Max [10 ▼] videos | [Enable ▼]
```

---

## EPIC 2: Dashboard / Overview Page

### Tujuan
Halaman pertama yang user lihat memberikan gambaran lengkap state sistem dan actionable next steps.

### Files to Create/Modify

**1. `app/src/app/page.tsx`** (REWRITE — bukan redirect lagi)
- Tidak redirect ke `/videos`, tapi tampilkan dashboard

**2. `app/src/app/api/dashboard/route.ts`** (NEW)
- Return aggregated stats: total videos, scripts, creators, last run, viral alerts count
- Recent activity feed
- Provider health summary

### UI Design
```
Dashboard Page
├── Header: "Good morning! Here's your content intelligence overview."
│
├── Stats Row (4 cards)
│   ├── 📹 47 Videos analyzed
│   ├── 📝 23 Scripts generated  
│   ├── 👥 6 Creators tracked
│   └── 🔥 3 Viral alerts
│
├── Quick Actions (jika ada masalah)
│   ├── ⚠ "Config 'AI Creators' has no matching creators" [Fix →]
│   ├── ⚠ "yt-dlp not installed — TikTok scraping disabled" [Setup →]
│   └── ✅ "All providers configured"
│
├── Recent Activity Feed
│   ├── 🔥 2h ago — @timothyronald posted viral video (1.2M views)
│   ├── ✅ 4h ago — Pipeline "Crypto Finance" completed (4 videos)
│   └── 📝 6h ago — 3 scripts generated
│
├── Top Viral This Week (mini cards)
│   ├── [thumbnail] @creator — 2.1M views — [Analyze] [Generate Script]
│   └── ...
│
└── Setup Checklist (jika belum lengkap)
    ├── ✅ Add creators
    ├── ✅ Create config
    ├── ⬜ Configure Gemini API key
    └── ⬜ Run first pipeline
```

---

## EPIC 3: Onboarding Wizard

### Tujuan
User baru langsung diarahkan ke setup yang benar tanpa kebingungan.

### Files to Create/Modify

**1. `app/src/app/onboarding/page.tsx`** (NEW)
- Multi-step wizard: 4 langkah
- Simpan progress ke localStorage

**2. `app/src/lib/onboarding.ts`** (NEW)
- `isOnboardingComplete()` — cek apakah setup sudah selesai
- `getOnboardingStep()` — return step yang belum selesai

### Wizard Steps
```
Step 1: "What niche are you in?"
  → Pilih dari: Finance | Beauty | Tech | Real Estate | Other
  → Auto-create Voice Profile dengan niche yang dipilih

Step 2: "Add your first competitor"
  → Input username + pilih platform (Instagram/TikTok/YouTube)
  → Auto-scrape stats
  → Bisa skip dan tambah nanti

Step 3: "Configure your AI"
  → Input Gemini API key (required)
  → Input Anthropic API key (optional)
  → Test connection langsung

Step 4: "Create your first config"
  → Nama config (pre-filled berdasarkan niche)
  → Category (auto-match dengan creator yang baru ditambah)
  → Analysis prompt (pre-filled template berdasarkan niche)
  → [Run First Pipeline →]
```

---

## EPIC 4: Config Management Redesign

### Tujuan
Config tidak lagi dibuat manual dengan textarea kosong. Ada template, preview creators, dan validasi.

### Files to Modify

**1. `app/src/app/configs/page.tsx`** (MAJOR REWRITE)

**Perubahan:**
- Tambah "Creator Preview" di setiap config card: tampilkan avatar creators yang akan di-scrape
- Tambah warning jika 0 creators match
- Tambah template prompt library
- Form dialog: tambah dropdown "Select from template" untuk analysis instruction

**2. `app/src/lib/prompt-templates.ts`** (NEW)
```typescript
export const ANALYSIS_TEMPLATES = {
  finance: `Analyze this short-form finance video for viral patterns...`,
  beauty: `Analyze this beauty/lifestyle video...`,
  tech: `Analyze this tech/AI video...`,
  realestate: `Analyze this real estate video...`,
  general: `Analyze this short-form video...`,
};

export const CONCEPTS_TEMPLATES = {
  finance: `Generate 3 adapted finance concepts...`,
  // ...
};
```

**3. `app/src/app/api/configs/route.ts`** (MODIFY)
- Tambah endpoint `GET /api/configs/:id/preview` — return creators yang match + count videos

### UI Changes
```
Config Card (redesigned)
├── Header: Config name + category badge
├── Creators Preview: [avatar] [avatar] [avatar] +2 more → "5 creators"
│   └── ⚠ "0 creators match — add creators with category 'AI'" [Fix]
├── Stats: 47 videos · 23 scripts · Last run: 2h ago
├── Prompt Preview (collapsed): "Analyze this finance video..."
└── Actions: [Edit] [Run Pipeline →] [Delete]

Config Form (redesigned)
├── Config Name: [input]
├── Category: [input] → live preview: "3 creators match ✓"
├── Analysis Prompt:
│   ├── [Use Template ▼]: Finance | Beauty | Tech | General
│   └── [textarea — pre-filled from template]
└── Concepts Prompt:
    ├── [Use Template ▼]
    └── [textarea]
```

---

## EPIC 5: Creator Management Redesign — Folder/Group View

### Tujuan
Creator yang sama di multiple platform dikelompokkan dalam satu "folder".

### Database Changes
**Tabel baru: `creator_groups`**
```sql
id: text PRIMARY KEY
name: text NOT NULL  -- "Timothy Ronald"
canonical_username: text NOT NULL  -- "timothyronald"
created_at: text
```

**Modify `creators` table:**
```sql
ADD COLUMN group_id text REFERENCES creator_groups(id)
```

### Files to Create/Modify

**1. `app/src/db/schema.ts`** — tambah `creator_groups` table

**2. `app/src/db/repositories.ts`** — tambah `creatorGroups` repo

**3. `app/src/app/api/creator-groups/route.ts`** (NEW)
- `GET` — list groups dengan creators
- `POST` — create group
- `PUT` — update group (rename, add/remove creators)
- `DELETE` — delete group

**4. `app/src/lib/creator-grouping.ts`** (NEW)
- `detectSameCreator(creator1, creator2)` — fuzzy match nama
- `autoGroupCreators(creators)` — auto-detect dan suggest grouping
- `mergeCreatorStats(group)` — aggregate stats lintas platform

**5. `app/src/app/creators/creators-client.tsx`** (MAJOR REWRITE)

### UI Design
```
Creators Page
├── View Toggle: [Grid ▼] [Grouped ▼]
│
├── Grouped View:
│   ├── 📁 Timothy Ronald (3 platforms)
│   │   ├── [IG icon] @timothyronald — 2.1M followers — 47 reels/30d
│   │   ├── [TT icon] @timothyronald — 890K followers — 23 videos/30d
│   │   └── [YT icon] @TimothyRonald — 1.2M subscribers — 15 shorts/30d
│   │   └── Combined: 4.2M reach · Avg 450K views
│   │
│   └── 📁 Kerjaweb3 (2 platforms)
│       ├── [IG icon] @kerjaweb3 — 45K followers
│       └── [TT icon] @kerjaweb3_ — 23K followers
│
└── Add Creator:
    ├── Auto-detect: paste any URL → auto-detect platform + username
    └── Manual: username + platform dropdown
```

---

## EPIC 6: Run Pipeline UX Redesign

### Tujuan
User tidak bisa run pipeline yang akan gagal. Ada validasi, preview, dan guided experience.

### Files to Modify

**1. `app/src/app/run/page.tsx`** (MAJOR REWRITE)

**Perubahan:**
- Saat pilih config → langsung tampilkan preview: "Will scrape X creators, estimated Y videos"
- Validasi sebelum run: cek creators, cek API keys, cek voice profile
- Tambah "Quick Run" mode: pilih config → klik run (tanpa advanced settings)
- Tambah estimated time: "~5 minutes for 4 videos"

**2. `app/src/app/api/pipeline/validate/route.ts`** (NEW)
- `POST` dengan `{ configName, params }` → return validation result
- Check: creators exist, API keys configured, voice profile exists

### UI Changes
```
Run Pipeline (redesigned)
├── Step 1: Select Config
│   ├── Config dropdown dengan preview
│   └── Preview card: "4 creators · ~12 videos · ~8 minutes"
│
├── Step 2: Validation (auto-run saat config dipilih)
│   ├── ✅ 4 creators found (kristofferkepin, timothyronald, ...)
│   ├── ✅ Gemini API key configured
│   ├── ✅ Voice profile set up
│   └── ⚠ No avatar configured — videos won't be generated
│
├── Step 3: Pipeline Steps (simplified)
│   ├── [✓] Scrape & Analyze (required)
│   ├── [✓] Generate Scripts (recommended)
│   └── [ ] Generate Videos (requires FAL_KEY)
│
└── [▶ Run Pipeline] — disabled jika ada critical error
```

---

## EPIC 7: Run History Redesign

### Tujuan
Run history yang human-readable, bukan raw JSON dump.

### Files to Modify

**1. `app/src/app/runs/page.tsx`** (REWRITE)

### UI Design
```
Run History
├── Run Card (redesigned)
│   ├── Header: "Crypto Finance Global" · Apify · 2h ago
│   ├── Status badge: ✅ Completed / ❌ Failed / 🔄 Running
│   ├── Stats row: 4 scraped · 3 analyzed · 2 scripts · 1 error
│   ├── Progress bar (jika running)
│   ├── Error summary (jika ada): "1 video failed: Gemini timeout"
│   └── Actions: [View Videos →] [View Scripts →] [Retry] [Details ▼]
│
└── Details (expandable, bukan raw JSON)
    ├── Timeline:
    │   ├── 10:54 — Started scraping 2 creators
    │   ├── 10:55 — Scraped @kristofferkepin: 3 videos
    │   ├── 10:56 — Scraped @timothyronald: 1 video
    │   ├── 10:57 — Analyzing video 1/4...
    │   └── 11:02 — Completed: 3 analyzed, 1 failed
    └── Errors (human-readable):
        └── ⚠ @kristofferkepin/DX28sHaThCk — Gemini safety block
            → Suggestion: Try re-importing this video URL
```

---

## EPIC 8: UI/Design Overhaul

### Tujuan
Loading screen, animasi smooth, scrollbar hilang, logo baru, sidebar redesign.

### Files to Create/Modify

**1. `app/src/app/layout.tsx`** (MODIFY)
- Tambah loading screen component
- Tambah page transition wrapper

**2. `app/src/components/loading-screen.tsx`** (NEW)
- Full-screen loading dengan logo animasi
- Hanya muncul saat pertama kali load (cek localStorage)

**3. `app/src/components/page-transition.tsx`** (NEW)
- Wrapper dengan fade-in animation untuk setiap page

**4. `app/src/app/globals.css`** (MODIFY)
- Hide scrollbar: `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`
- Tambah custom scrollbar yang tipis dan subtle untuk area yang perlu scroll

**5. `app/src/components/app-sidebar.tsx`** (MODIFY)
- Logo baru: gradient icon dengan animasi subtle
- Subtitle: "Social Media Intelligence" (bukan "Instagram Reels AI")
- Reorganize nav: Setup section + Intelligence section + Studio section
- Tambah viral alert badge di sidebar

**6. `app/src/components/top-bar.tsx`** (MODIFY)
- Tambah breadcrumb navigation
- Tambah global search (Cmd+K)
- Tambah notification bell dengan viral alerts

### Loading Screen Design
```
[Full screen dark background]
[Center: Logo animasi — gradient neon icon spinning/pulsing]
[Below: "Virality System" dengan gradient text]
[Progress bar tipis di bawah]
[Fade out setelah 1.5 detik atau saat data loaded]
```

### New Logo Design
```
Icon: Stylized "V" atau lightning bolt dengan gradient neon-to-emerald
Font: Geist Bold, gradient text
Tagline: "Social Media Intelligence"
```

### Sidebar Reorganization
```
Sidebar (redesigned)
├── Logo + Brand
│
├── INTELLIGENCE
│   ├── 🏠 Dashboard (new)
│   ├── 📹 Videos
│   └── 🔥 Viral Alerts (new) [badge: 3]
│
├── PIPELINE
│   ├── ▶ Run Pipeline
│   ├── 📋 Run History
│   └── 📥 Manual Import
│
├── SETUP
│   ├── 👥 Creators
│   └── ⚙ Configs
│
├── STUDIO
│   ├── 📝 My Scripts
│   ├── 🎬 Generated Videos
│   ├── 🎭 Avatars
│   ├── 🎤 Voice Profiles
│   └── 📚 Prompt Library
│
└── SYSTEM
    └── ⚙ Settings (provider config)
```

---

## EPIC 9: Toast Notification System

### Tujuan
Feedback yang konsisten di seluruh app.

### Files to Create

**1. `app/src/components/ui/toast-provider.tsx`** (NEW)
- Wrapper dengan Radix Toast atau custom implementation
- Types: success, error, warning, info
- Auto-dismiss setelah 4 detik

**2. `app/src/hooks/use-toast.ts`** (NEW)
- `toast.success("Config saved!")` 
- `toast.error("Pipeline failed: ...")`
- `toast.warning("0 creators found")`

**3. Update semua pages** untuk menggunakan toast alih-alih `alert()` atau inline error text.

---

## EPIC 10: Search & Filter Global

### Tujuan
User bisa search di semua halaman dengan Cmd+K.

### Files to Create

**1. `app/src/components/global-search.tsx`** (NEW)
- Command palette (Cmd+K)
- Search across: videos (by creator/caption), scripts (by title), creators (by username)
- Recent searches
- Quick actions: "Run Pipeline", "Add Creator", "Import URLs"

**2. `app/src/app/api/search/route.ts`** (NEW)
- `GET /api/search?q=keyword` — search across all entities
- Return: videos, scripts, creators yang match

---

## Checklist Phase 1

### Backend
- [ ] `app/src/lib/app-settings.ts` — provider settings dari DB
- [ ] `app/src/app/api/settings/providers/route.ts` — CRUD settings
- [ ] `app/src/app/api/dashboard/route.ts` — aggregated stats
- [ ] `app/src/app/api/pipeline/validate/route.ts` — pre-run validation
- [ ] `app/src/app/api/creator-groups/route.ts` — group management
- [ ] `app/src/app/api/search/route.ts` — global search
- [ ] `app/src/lib/prompt-templates.ts` — prompt templates per niche
- [ ] `app/src/lib/creator-grouping.ts` — auto-detect same creator
- [ ] `app/src/lib/onboarding.ts` — onboarding state
- [ ] DB schema: `creator_groups` table + `group_id` di creators

### Frontend
- [ ] `app/src/app/page.tsx` — Dashboard (bukan redirect)
- [ ] `app/src/app/settings/page.tsx` — Provider settings UI
- [ ] `app/src/app/onboarding/page.tsx` — Wizard
- [ ] `app/src/app/configs/page.tsx` — Redesign dengan templates
- [ ] `app/src/app/creators/creators-client.tsx` — Group view
- [ ] `app/src/app/run/page.tsx` — Validation + preview
- [ ] `app/src/app/runs/page.tsx` — Human-readable history
- [ ] `app/src/components/loading-screen.tsx` — Splash screen
- [ ] `app/src/components/page-transition.tsx` — Smooth transitions
- [ ] `app/src/components/app-sidebar.tsx` — Redesign
- [ ] `app/src/components/top-bar.tsx` — Search + notifications
- [ ] `app/src/components/global-search.tsx` — Cmd+K search
- [ ] `app/src/components/ui/toast-provider.tsx` — Toast system
- [ ] `app/src/app/globals.css` — Hide scrollbar + animations
