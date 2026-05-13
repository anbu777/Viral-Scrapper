# MASTER IMPLEMENTATION PLAN — Phase 2: Auto-Scraping & Viral Detection

## Overview
Phase 2 menambahkan sistem auto-scraping terjadwal dengan viral detection, alert dashboard, dan integrasi YouTube Data API v3 + Apify TikTok Scraper untuk menggantikan yt-dlp yang tidak reliable.

---

## EPIC 11: Scheduler Architecture

### Tujuan
Sistem yang secara otomatis scrape creators sesuai jadwal, deteksi konten viral, dan kirim alert.

### Pendekatan Teknis
Tidak menggunakan cron job eksternal. Menggunakan **self-scheduling via database** yang di-trigger oleh:
1. Request ke app (middleware check)
2. Manual trigger dari dashboard
3. Dedicated endpoint yang bisa di-ping oleh Vercel Cron / external cron

### Database Changes

**Tabel baru: `scheduler_jobs`**
```sql
id: text PRIMARY KEY
creator_id: text REFERENCES creators(id)
platform: text NOT NULL  -- "instagram" | "tiktok" | "youtube_shorts"
interval_minutes: integer NOT NULL DEFAULT 360  -- 6 jam default
last_run_at: text
next_run_at: text NOT NULL
status: text DEFAULT "idle"  -- "idle" | "running" | "error"
last_error: text
consecutive_errors: integer DEFAULT 0
enabled: integer DEFAULT 1
created_at: text
updated_at: text
```

**Tabel baru: `viral_alerts`**
```sql
id: text PRIMARY KEY
video_id: text REFERENCES videos(id)
creator_id: text REFERENCES creators(id)
virality_score: real NOT NULL
threshold_used: real NOT NULL
score_breakdown: text  -- JSON
seen: integer DEFAULT 0
notified: integer DEFAULT 0  -- sudah dikirim ke Telegram/Discord?
created_at: text
```

**Tabel baru: `scheduler_runs`**
```sql
id: text PRIMARY KEY
job_id: text REFERENCES scheduler_jobs(id)
started_at: text
completed_at: text
status: text  -- "success" | "failed" | "no_new_content"
videos_found: integer DEFAULT 0
viral_detected: integer DEFAULT 0
error_message: text
```

### Files to Create

**1. `app/src/lib/scheduler.ts`** (NEW)
```typescript
// Core scheduler logic
export async function runSchedulerTick(): Promise<void>
  // Cek jobs yang next_run_at <= now
  // Jalankan scrape untuk setiap job yang due
  // Update next_run_at setelah selesai

export async function scheduleCreator(creatorId: string, intervalMinutes: number): Promise<void>
  // Buat atau update scheduler_job untuk creator

export async function getSchedulerStatus(): Promise<SchedulerStatus>
  // Return: jobs count, next run, last run, alerts count

export async function detectViralContent(reels: ScrapedReel[], creator: Creator): Promise<ViralAlert[]>
  // Bandingkan virality score dengan creator's baseline
  // Return reels yang score > threshold (default: 2x baseline)
```

**2. `app/src/lib/viral-detector.ts`** (NEW)
```typescript
export interface ViralThreshold {
  multiplier: number  // default: 2.0 (2x baseline)
  minViews: number    // default: 10000
  minScore: number    // default: 50
}

export function isViral(reel: ScrapedReel, creator: Creator, threshold: ViralThreshold): boolean
export function getViralityMultiplier(reel: ScrapedReel, creator: Creator): number
export async function saveViralAlert(videoId: string, creatorId: string, score: number): Promise<void>
export async function getUnseenAlerts(): Promise<ViralAlert[]>
export async function markAlertSeen(alertId: string): Promise<void>
```

**3. `app/src/app/api/scheduler/route.ts`** (NEW)
- `GET /api/scheduler` — status semua jobs
- `POST /api/scheduler/tick` — manual trigger (juga dipanggil oleh middleware)
- `POST /api/scheduler/enable` — enable/disable job
- `PUT /api/scheduler/interval` — update interval

**4. `app/src/app/api/scheduler/alerts/route.ts`** (NEW)
- `GET` — list viral alerts (unseen first)
- `PATCH /:id/seen` — mark as seen
- `DELETE /:id` — dismiss alert

**5. `app/src/middleware.ts`** (NEW atau MODIFY)
```typescript
// Setiap request ke app, cek apakah ada scheduler jobs yang due
// Jalankan di background (non-blocking)
export function middleware(request: NextRequest) {
  // Fire-and-forget scheduler tick
  fetch('/api/scheduler/tick', { method: 'POST' }).catch(() => {})
  return NextResponse.next()
}
```

### Scheduler Flow
```
Every request to app:
  middleware → POST /api/scheduler/tick (background)
    → Query: SELECT * FROM scheduler_jobs WHERE next_run_at <= now AND enabled = 1
    → For each due job:
        1. Set status = "running"
        2. Scrape creator (metadata only, fast)
        3. Calculate virality scores
        4. Compare with creator baseline
        5. If viral: INSERT viral_alerts + send notification
        6. Update next_run_at = now + interval_minutes
        7. Set status = "idle"
```

### Rate Limiting Strategy
```
Instagram (Apify):
  - Default interval: 360 min (6 jam)
  - Max per day: 4 runs per creator
  - Cost estimate: ~$0.04/creator/day

TikTok (Apify TikTok):
  - Default interval: 120 min (2 jam)
  - Max per day: 12 runs per creator
  - Cost estimate: ~$0.12/creator/day

YouTube (YouTube API v3):
  - Default interval: 60 min (1 jam)
  - Quota: 10,000 units/day (gratis)
  - Cost: $0
```

---

## EPIC 12: Viral Alerts Dashboard

### Tujuan
Halaman khusus untuk melihat dan mengelola viral alerts.

### Files to Create

**1. `app/src/app/viral-alerts/page.tsx`** (NEW)

### UI Design
```
Viral Alerts Page
├── Header: "🔥 Viral Alerts" + badge count
├── Filter: [All ▼] [Unseen ▼] [Instagram ▼] [TikTok ▼] [YouTube ▼]
│
├── Alert Cards
│   ├── 🔥 NEW — @timothyronald (TikTok)
│   │   ├── [thumbnail] "3 stocks I'm buying..."
│   │   ├── 1.1M views · 2.3x creator baseline · Posted 3h ago
│   │   ├── Virality Score: 847 (threshold: 400)
│   │   └── Actions: [Analyze Now] [Generate Script] [Dismiss]
│   │
│   └── 🔥 NEW — @kristofferkepin (Instagram)
│       ├── [thumbnail] "Kejadian hacking tergila..."
│       ├── 1.35M views · 3.1x baseline · Posted 1d ago
│       └── Actions: [Analyze Now] [Generate Script] [Dismiss]
│
└── Settings: Viral threshold: [2x ▼] | Min views: [10,000]
```

**2. Update `app/src/components/app-sidebar.tsx`**
- Tambah "Viral Alerts" di nav dengan badge count yang update real-time

**3. Update `app/src/components/top-bar.tsx`**
- Tambah notification bell yang menampilkan viral alerts

---

## EPIC 13: Apify TikTok Scraper Integration

### Tujuan
Ganti yt-dlp untuk TikTok dengan Apify TikTok Scraper yang lebih reliable.

### Apify Actor
- Actor: `clockworks/tiktok-scraper` atau `apify/tiktok-scraper`
- Cost: ~$0.02 per run (50 videos)
- Reliability: ⭐⭐⭐⭐⭐

### Files to Create/Modify

**1. `app/src/lib/providers/apify-tiktok-provider.ts`** (NEW)
```typescript
export const apifyTiktokProvider: InstagramScraperProvider = {
  name: "apify_tiktok",
  
  async scrapeCreatorStats(username: string): Promise<CreatorStats> {
    // Call Apify TikTok scraper actor
    // Return: followers, avgViews, reelsCount
  },
  
  async scrapeReels(input: ScrapeReelsInput): Promise<ScrapedReel[]> {
    // Call Apify TikTok scraper
    // Input: username, maxVideos, nDays
    // Return: ScrapedReel[] dengan views, likes, thumbnail, videoUrl
  },
  
  async downloadVideo(input: DownloadVideoInput): Promise<{ buffer: Buffer; contentType: string }> {
    // Download via videoFileUrl dari Apify result
  },
  
  async validateSession(): Promise<{ status: SessionStatus; message: string }> {
    // Check APIFY_API_TOKEN exists
  }
}
```

**2. `app/src/lib/providers/index.ts`** (MODIFY)
- Tambah `apify_tiktok` ke providers map
- Update `getProviderForPlatform("tiktok")` untuk cek settings DB

**3. `app/src/lib/app-settings.ts`** (MODIFY)
- Tambah logic: jika TikTok provider = "apify_tiktok", gunakan apifyTiktokProvider

### Apify TikTok API Call
```typescript
const response = await fetch(
  `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${token}`,
  {
    method: "POST",
    body: JSON.stringify({
      profiles: [`https://www.tiktok.com/@${username}`],
      resultsPerPage: maxVideos,
      shouldDownloadVideos: false,  // metadata only untuk scraping
      shouldDownloadCovers: true,
    })
  }
)
```

---

## EPIC 14: YouTube Data API v3 Integration

### Tujuan
Ganti yt-dlp untuk YouTube metadata dengan YouTube Data API v3 yang gratis dan reliable.

### YouTube API Quota
- 10,000 units/day gratis
- Search: 100 units/call
- Videos list: 1 unit/call
- Channels: 1 unit/call
- Estimasi: 1 creator scrape = ~5 units → bisa scrape 2,000 creators/day gratis

### Files to Create

**1. `app/src/lib/providers/youtube-api-provider.ts`** (NEW)
```typescript
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export const youtubeApiProvider: InstagramScraperProvider = {
  name: "youtube_api",
  
  async scrapeCreatorStats(username: string): Promise<CreatorStats> {
    // 1. GET /channels?forHandle=@username&part=statistics,snippet
    // 2. Return: subscribers, profilePic
    // 3. GET /search?channelId=X&type=video&videoDuration=short&order=date
    // 4. Calculate avgViews dari recent shorts
  },
  
  async scrapeReels(input: ScrapeReelsInput): Promise<ScrapedReel[]> {
    // 1. GET channel ID dari username
    // 2. GET /search?channelId=X&type=video&videoDuration=short&maxResults=50
    // 3. GET /videos?id=id1,id2,...&part=statistics,snippet,contentDetails
    // 4. Filter: duration <= 60s (Shorts)
    // 5. Return ScrapedReel[]
  },
  
  async downloadVideo(input: DownloadVideoInput): Promise<{ buffer: Buffer; contentType: string }> {
    // Fallback ke yt-dlp untuk download actual video
    return downloadVideoToBuffer(input.postUrl || input.videoFileUrl || "")
  }
}
```

**2. Update `app/src/lib/providers/index.ts`**
- Tambah `youtube_api` ke providers map

---

## EPIC 15: Notification System Expansion

### Tujuan
Tambah Discord dan Email notification selain Telegram yang sudah ada.

### Files to Create

**1. `app/src/lib/discord.ts`** (NEW)
```typescript
export async function sendDiscordAlert(params: {
  title: string
  description: string
  thumbnailUrl?: string
  videoUrl?: string
  viralityScore?: number
}): Promise<void> {
  // POST ke Discord webhook URL
  // Format: embed dengan thumbnail, stats, action buttons
}
```

**2. `app/src/lib/email.ts`** (NEW)
```typescript
// Menggunakan Resend API (gratis 3k/month)
export async function sendEmailAlert(params: {
  subject: string
  html: string
}): Promise<void>

export async function sendViralAlertEmail(alert: ViralAlert): Promise<void>
export async function sendWeeklyReport(report: WeeklyReport): Promise<void>
```

**3. `app/src/lib/notifications.ts`** (NEW)
```typescript
// Unified notification dispatcher
export async function sendViralAlert(alert: ViralAlert): Promise<void> {
  const settings = await getProviderSettings()
  
  if (settings.notifications.telegram.enabled) {
    await sendTelegramNotification(...)
  }
  if (settings.notifications.discord.enabled) {
    await sendDiscordAlert(...)
  }
  if (settings.notifications.email.enabled) {
    await sendEmailAlert(...)
  }
}
```

---

## Checklist Phase 2

### Database
- [ ] Schema: `scheduler_jobs` table
- [ ] Schema: `viral_alerts` table
- [ ] Schema: `scheduler_runs` table
- [ ] Migration script

### Backend
- [ ] `app/src/lib/scheduler.ts` — core scheduler
- [ ] `app/src/lib/viral-detector.ts` — viral detection logic
- [ ] `app/src/lib/providers/apify-tiktok-provider.ts` — Apify TikTok
- [ ] `app/src/lib/providers/youtube-api-provider.ts` — YouTube Data API
- [ ] `app/src/lib/discord.ts` — Discord notifications
- [ ] `app/src/lib/email.ts` — Email via Resend
- [ ] `app/src/lib/notifications.ts` — Unified dispatcher
- [ ] `app/src/app/api/scheduler/route.ts` — Scheduler API
- [ ] `app/src/app/api/scheduler/alerts/route.ts` — Alerts API
- [ ] `app/src/middleware.ts` — Background scheduler tick
- [ ] Update `providers/index.ts` — tambah new providers

### Frontend
- [ ] `app/src/app/viral-alerts/page.tsx` — Alerts dashboard
- [ ] Update sidebar — viral alerts badge
- [ ] Update top-bar — notification bell
- [ ] Update settings — scheduler config per creator
