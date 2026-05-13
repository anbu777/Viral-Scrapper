# MASTER IMPLEMENTATION PLAN — Phase 3: Advanced Features

## Overview
Phase 3 menambahkan fitur-fitur advanced: trend visualization, content calendar, script versioning, competitor intelligence report, dan niche discovery.

---

## EPIC 16: Trend Visualization Dashboard

### Tujuan
Mengubah app dari "scraper" menjadi "intelligence platform" dengan chart dan analytics.

### Dependencies
- `recharts` — chart library (lightweight, React-native)

### Files to Create

**1. `app/src/app/trends/page.tsx`** (NEW)

**2. `app/src/app/api/analytics/route.ts`** (NEW)
```typescript
// GET /api/analytics?period=7d|30d|90d
// Return:
{
  viewsOverTime: [{ date, totalViews, platform }],
  topCreators: [{ username, avgViews, viralCount }],
  topFormats: [{ format, count, avgViews }],
  postingHeatmap: [{ hour, dayOfWeek, avgEngagement }],
  viralPatterns: {
    avgDuration: number,
    topHooks: string[],
    topFormats: string[],
  }
}
```

### UI Design
```
Trends Page
├── Period selector: [7 days ▼] [30 days ▼] [90 days ▼]
│
├── Row 1: Key Metrics
│   ├── Total Views Tracked: 47.2M (+23% vs last period)
│   ├── Viral Videos: 12 (+4)
│   ├── Avg Virality Score: 342 (+18%)
│   └── Most Active Platform: TikTok (67%)
│
├── Row 2: Charts
│   ├── [Line Chart] Views over time per platform
│   └── [Bar Chart] Top creators by avg views
│
├── Row 3: Patterns
│   ├── [Heatmap] Best posting times (hour × day)
│   ├── [Pie Chart] Content format distribution
│   └── [Bar Chart] Top hook styles
│
└── Row 4: Competitor Comparison
    ├── Select creators to compare: [dropdown multi-select]
    └── [Line Chart] Views comparison over time
```

---

## EPIC 17: Content Calendar

### Tujuan
User bisa plan konten berdasarkan scripts yang sudah di-generate.

### Database Changes

**Tabel baru: `content_calendar`**
```sql
id: text PRIMARY KEY
script_id: text REFERENCES scripts(id)
scheduled_date: text NOT NULL
platform: text NOT NULL
status: text DEFAULT "draft"  -- "draft" | "recorded" | "posted" | "cancelled"
posted_url: text  -- URL setelah diposting
notes: text
created_at: text
updated_at: text
```

### Files to Create

**1. `app/src/app/calendar/page.tsx`** (NEW)
- Calendar view (week/month)
- Drag-and-drop scripts ke tanggal
- Status tracking per content

**2. `app/src/app/api/calendar/route.ts`** (NEW)
- CRUD untuk calendar entries

### UI Design
```
Content Calendar
├── View: [Week ▼] [Month ▼]
├── [← Prev] May 2026 [Next →]
│
├── Calendar Grid
│   ├── Mon 13: [Script card] "3 stocks I'm buying" · TikTok · Draft
│   ├── Wed 15: [Script card] "Crypto trends 2026" · Instagram · Recorded
│   └── Fri 17: [+ Add] (drag script here)
│
└── Sidebar: Unscheduled Scripts
    ├── [drag] "Humanoid robots explained"
    └── [drag] "Why Bitcoin is different"
```

---

## EPIC 18: Script Versioning & A/B Testing

### Tujuan
Generate multiple hook variations dan track mana yang perform terbaik.

### Database Changes

**Modify `scripts` table:**
```sql
ADD COLUMN parent_script_id text REFERENCES scripts(id)
ADD COLUMN version integer DEFAULT 1
ADD COLUMN ab_group text  -- "A" | "B" | "C"
ADD COLUMN performance_views integer
ADD COLUMN performance_tracked_at text
```

### Files to Create/Modify

**1. `app/src/app/api/scripts/[id]/variations/route.ts`** (NEW)
- `POST` — generate N hook variations untuk script yang ada
- Menggunakan AI untuk generate 3 variasi hook yang berbeda

**2. `app/src/lib/script-variations.ts`** (NEW)
```typescript
export async function generateHookVariations(
  script: Script,
  count: number = 3
): Promise<Script[]>
// Menggunakan AI untuk generate variasi hook:
// - Variasi 1: Question hook ("Did you know...?")
// - Variasi 2: Shock hook ("Most people are wrong about...")
// - Variasi 3: Story hook ("Last week I discovered...")
```

**3. Update `app/src/app/scripts/page.tsx`**
- Tampilkan variasi sebagai sub-cards
- Tombol "Generate Variations" per script
- A/B comparison view

---

## EPIC 19: Competitor Intelligence Report

### Tujuan
Auto-generate weekly report tentang trend dan rekomendasi konten.

### Files to Create

**1. `app/src/lib/report-generator.ts`** (NEW)
```typescript
export interface WeeklyReport {
  period: { from: string; to: string }
  topVideos: Video[]
  viralPatterns: {
    formats: string[]
    hooks: string[]
    avgDuration: number
    bestPostingTimes: string[]
  }
  recommendations: string[]
  generatedAt: string
}

export async function generateWeeklyReport(configName: string): Promise<WeeklyReport>
// 1. Query top videos dari minggu ini
// 2. Analyze patterns dengan AI
// 3. Generate recommendations
// 4. Return structured report

export async function exportReportAsMarkdown(report: WeeklyReport): Promise<string>
export async function exportReportAsPDF(report: WeeklyReport): Promise<Buffer>
```

**2. `app/src/app/api/reports/route.ts`** (NEW)
- `POST /generate` — generate report untuk config tertentu
- `GET` — list generated reports
- `GET /:id/download` — download as MD atau PDF

**3. `app/src/app/reports/page.tsx`** (NEW)
- List reports
- Preview report inline
- Download buttons

---

## EPIC 20: Niche Discovery

### Tujuan
User input keyword → sistem temukan top creators di niche tersebut.

### Files to Create

**1. `app/src/app/discover/page.tsx`** (NEW)

**2. `app/src/app/api/discover/route.ts`** (NEW)
```typescript
// POST /api/discover
// Input: { keyword, platform, maxCreators }
// Process:
//   1. Search TikTok/Instagram/YouTube untuk keyword
//   2. Extract top creators dari hasil search
//   3. Scrape stats untuk setiap creator
//   4. Return ranked list
// Output: Creator[] dengan stats
```

**3. `app/src/lib/niche-discovery.ts`** (NEW)
```typescript
export async function discoverCreators(params: {
  keyword: string
  platform: SocialPlatform
  maxCreators: number
}): Promise<DiscoveredCreator[]>

export interface DiscoveredCreator {
  username: string
  platform: SocialPlatform
  followers: number
  avgViews: number
  viralityScore: number
  sampleVideos: ScrapedReel[]
  alreadyTracked: boolean
}
```

### UI Design
```
Discover Page
├── Search: [keyword input] [Platform: All ▼] [Search]
│
├── Results: "Found 23 creators for 'crypto indonesia'"
│   ├── Creator Card
│   │   ├── @timothyronald · TikTok · 890K followers
│   │   ├── Avg views: 450K · Virality: High
│   │   ├── [thumbnail] [thumbnail] [thumbnail] (sample videos)
│   │   └── [+ Add to Creators] (disabled jika sudah tracked)
│   └── ...
│
└── Bulk: [Add All Selected →]
```

---

## EPIC 21: Performance Tracker

### Tujuan
Track performa video yang sudah diposting dan improve prediksi virality.

### Database Changes

**Tabel baru: `posted_content`**
```sql
id: text PRIMARY KEY
script_id: text REFERENCES scripts(id)
posted_url: text NOT NULL
platform: text NOT NULL
posted_at: text NOT NULL
views_24h: integer
views_48h: integer
views_7d: integer
likes_7d: integer
comments_7d: integer
last_checked_at: text
created_at: text
```

### Files to Create

**1. `app/src/app/performance/page.tsx`** (NEW)
- List posted content dengan performance metrics
- Comparison: predicted virality vs actual performance

**2. `app/src/app/api/performance/route.ts`** (NEW)
- CRUD untuk posted content
- Auto-fetch metrics via yt-dlp/API

---

## EPIC 22: Multi-Account Support (Optional/Future)

### Tujuan
Multiple brand profiles dalam satu instance.

### Database Changes
```sql
-- Tambah brand_id ke semua tabel utama
ALTER TABLE creators ADD COLUMN brand_id text
ALTER TABLE configs ADD COLUMN brand_id text
ALTER TABLE videos ADD COLUMN brand_id text
ALTER TABLE scripts ADD COLUMN brand_id text

-- Tabel baru
CREATE TABLE brands (
  id text PRIMARY KEY,
  name text NOT NULL,
  niche text,
  color text,  -- untuk color coding di UI
  created_at text
)
```

### Note
Epic ini hanya diimplementasikan jika project akan digunakan untuk multiple brands/clients.

---

## Checklist Phase 3

### Database
- [ ] Schema: `content_calendar` table
- [ ] Schema: `posted_content` table
- [ ] Schema: `brands` table (optional)
- [ ] Modify `scripts`: add versioning columns

### Backend
- [ ] `app/src/app/api/analytics/route.ts` — analytics data
- [ ] `app/src/app/api/calendar/route.ts` — calendar CRUD
- [ ] `app/src/app/api/scripts/[id]/variations/route.ts` — script variations
- [ ] `app/src/app/api/reports/route.ts` — report generation
- [ ] `app/src/app/api/discover/route.ts` — niche discovery
- [ ] `app/src/app/api/performance/route.ts` — performance tracking
- [ ] `app/src/lib/report-generator.ts` — report logic
- [ ] `app/src/lib/script-variations.ts` — variation generation
- [ ] `app/src/lib/niche-discovery.ts` — discovery logic

### Frontend
- [ ] `app/src/app/trends/page.tsx` — trend charts
- [ ] `app/src/app/calendar/page.tsx` — content calendar
- [ ] `app/src/app/reports/page.tsx` — intelligence reports
- [ ] `app/src/app/discover/page.tsx` — niche discovery
- [ ] `app/src/app/performance/page.tsx` — performance tracker
- [ ] Update scripts page — versioning UI
- [ ] Install `recharts` dependency
