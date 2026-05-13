# MASTER IMPLEMENTATION PLAN — Task Breakdown & Execution Order

## Prinsip Eksekusi
1. Setiap task harus bisa di-test secara independen
2. Backend sebelum frontend
3. Database changes sebelum API
4. Tidak ada breaking changes pada fitur yang sudah berjalan

---

## WAVE 0: Critical Bug Fixes (Sebelum Apapun)
*Estimasi: 1-2 jam*

- [x] Fix `text.toLowerCase is not a function` di `quality.ts`
- [x] Fix `SQLite3 can only bind` di `repositories.ts` (undefined → null)
- [x] Fix category case-insensitive matching di `repo.creators.list`
- [x] Fix pipeline stuck saat 0 creators ditemukan
- [x] Fix Gemini file processing timeout (120s → 300s)
- [x] Fix `scrapeRunId`, `duration`, `videoFileUrl` undefined → null di upsertScraped

---

## WAVE 1: Settings & Provider Infrastructure
*Estimasi: 2-3 hari*
*Dependency: Wave 0*

### Task 1.1: Database — App Settings
- [ ] Tambah helper functions di `app/src/db/repositories.ts`:
  - `repo.settings.get(key)` — baca setting
  - `repo.settings.set(key, value)` — simpan setting
  - `repo.settings.getAll()` — semua settings

### Task 1.2: Provider Settings Library
- [ ] Buat `app/src/lib/app-settings.ts`:
  - `getProviderSettings()` — baca dari DB, fallback ke env
  - `saveProviderSettings(settings)` — simpan ke DB
  - `getEffectiveScraperProvider(platform)` — resolve per platform
  - `getEffectiveAiProvider(task)` — resolve per task
  - `testProviderConnection(provider, config)` — test koneksi

### Task 1.3: Settings API
- [ ] Buat `app/src/app/api/settings/providers/route.ts`:
  - `GET` — return settings (mask API keys)
  - `POST` — save settings
- [ ] Buat `app/src/app/api/settings/test/route.ts`:
  - `POST { provider, config }` — test connection

### Task 1.4: Update Pipeline to Use DB Settings
- [ ] Modify `app/src/lib/pipeline-runs.ts`:
  - Ganti `getEnv()` dengan `getProviderSettings()` untuk provider resolution
  - Fallback chain: DB → env → default

### Task 1.5: Settings UI
- [ ] Rewrite `app/src/app/settings/page.tsx`:
  - Tabs: Scraping | AI | TTS | Video | Notifications | Schedule
  - Per provider: dropdown, API key input (masked), Test button
  - Status indicators
  - Save dengan toast

---

## WAVE 2: Dashboard & Navigation
*Estimasi: 2-3 hari*
*Dependency: Wave 1*

### Task 2.1: Dashboard API
- [ ] Buat `app/src/app/api/dashboard/route.ts`:
  - Stats: total videos, scripts, creators, alerts
  - Recent activity (last 10 events)
  - Provider health summary
  - Quick action items (warnings)

### Task 2.2: Dashboard Page
- [ ] Rewrite `app/src/app/page.tsx` (bukan redirect):
  - Stats cards
  - Quick actions / warnings
  - Recent activity feed
  - Setup checklist (jika belum complete)

### Task 2.3: Sidebar Redesign
- [ ] Modify `app/src/components/app-sidebar.tsx`:
  - Logo baru dengan gradient
  - Subtitle: "Social Media Intelligence"
  - Reorganize nav sections: Intelligence | Pipeline | Setup | Studio | System
  - Viral alerts badge (real-time)

### Task 2.4: Top Bar Enhancement
- [ ] Modify `app/src/components/top-bar.tsx`:
  - Breadcrumb navigation
  - Notification bell (viral alerts)
  - Global search trigger (Cmd+K)

### Task 2.5: Loading Screen
- [ ] Buat `app/src/components/loading-screen.tsx`:
  - Full-screen dengan logo animasi
  - Hanya muncul sekali (localStorage flag)
  - Fade out setelah 1.5s

### Task 2.6: Page Transitions
- [ ] Buat `app/src/components/page-transition.tsx`:
  - Fade-in animation untuk setiap page
  - Wrap di layout.tsx

### Task 2.7: Global CSS Updates
- [ ] Modify `app/src/app/globals.css`:
  - Hide scrollbar (semua browser)
  - Custom thin scrollbar untuk area yang perlu
  - Tambah animation keyframes

---

## WAVE 3: Toast & UX Polish
*Estimasi: 1 hari*
*Dependency: Wave 2*

### Task 3.1: Toast System
- [ ] Buat `app/src/components/ui/toast-provider.tsx`
- [ ] Buat `app/src/hooks/use-toast.ts`
- [ ] Tambah ToastProvider ke `layout.tsx`
- [ ] Replace semua `alert()` dan inline error text dengan toast

### Task 3.2: Global Search
- [ ] Buat `app/src/components/global-search.tsx` (Cmd+K)
- [ ] Buat `app/src/app/api/search/route.ts`
- [ ] Tambah keyboard shortcut listener di layout

---

## WAVE 4: Onboarding & Config Improvements
*Estimasi: 2 hari*
*Dependency: Wave 3*

### Task 4.1: Prompt Templates
- [ ] Buat `app/src/lib/prompt-templates.ts`:
  - Templates per niche: finance, beauty, tech, realestate, general
  - Analysis templates + concepts templates

### Task 4.2: Config Page Redesign
- [ ] Rewrite `app/src/app/configs/page.tsx`:
  - Creator preview per config (live count)
  - Warning jika 0 creators match
  - Template dropdown untuk prompts
  - Validation sebelum save

### Task 4.3: Onboarding Wizard
- [ ] Buat `app/src/lib/onboarding.ts`
- [ ] Buat `app/src/app/onboarding/page.tsx`:
  - Step 1: Pilih niche
  - Step 2: Add first creator
  - Step 3: Configure AI key
  - Step 4: Create first config
- [ ] Tambah redirect ke onboarding jika belum complete

### Task 4.4: Run Pipeline Validation
- [ ] Buat `app/src/app/api/pipeline/validate/route.ts`
- [ ] Modify `app/src/app/run/page.tsx`:
  - Pre-run validation display
  - Creator count preview
  - Estimated time
  - Disable run button jika ada critical error

---

## WAVE 5: Creator Management Redesign
*Estimasi: 2 hari*
*Dependency: Wave 4*

### Task 5.1: Creator Groups Database
- [ ] Tambah `creator_groups` table ke `app/src/db/schema.ts`
- [ ] Tambah `group_id` column ke `creators` table
- [ ] Tambah `creatorGroups` repo ke `repositories.ts`
- [ ] Buat migration

### Task 5.2: Creator Groups API
- [ ] Buat `app/src/app/api/creator-groups/route.ts`
- [ ] Buat `app/src/lib/creator-grouping.ts`:
  - `detectSameCreator()` — fuzzy match
  - `autoGroupCreators()` — auto-suggest grouping

### Task 5.3: Creators Page Redesign
- [ ] Rewrite `app/src/app/creators/creators-client.tsx`:
  - Toggle: Grid view / Grouped view
  - Folder-style group cards
  - Auto-detect same creator suggestion
  - Add creator: paste URL → auto-detect platform

### Task 5.4: Run History Redesign
- [ ] Rewrite `app/src/app/runs/page.tsx`:
  - Human-readable timeline
  - Stats summary (tidak raw JSON)
  - Actionable error messages

---

## WAVE 6: New Scraping Providers
*Estimasi: 2-3 hari*
*Dependency: Wave 5*

### Task 6.1: Apify TikTok Provider
- [ ] Buat `app/src/lib/providers/apify-tiktok-provider.ts`
- [ ] Update `app/src/lib/providers/index.ts`
- [ ] Test dengan creator TikTok yang ada

### Task 6.2: YouTube Data API v3 Provider
- [ ] Buat `app/src/lib/providers/youtube-api-provider.ts`
- [ ] Update `app/src/lib/providers/index.ts`
- [ ] Test dengan creator YouTube yang ada

### Task 6.3: Provider Routing Update
- [ ] Modify `app/src/lib/pipeline-runs.ts`:
  - Gunakan `getEffectiveScraperProvider(platform)` dari app-settings
  - Support semua provider baru

---

## WAVE 7: Auto-Scraping Scheduler
*Estimasi: 3-4 hari*
*Dependency: Wave 6*

### Task 7.1: Scheduler Database
- [ ] Tambah `scheduler_jobs` table ke schema
- [ ] Tambah `viral_alerts` table ke schema
- [ ] Tambah `scheduler_runs` table ke schema
- [ ] Tambah repo methods

### Task 7.2: Scheduler Core
- [ ] Buat `app/src/lib/scheduler.ts`
- [ ] Buat `app/src/lib/viral-detector.ts`

### Task 7.3: Scheduler API
- [ ] Buat `app/src/app/api/scheduler/route.ts`
- [ ] Buat `app/src/app/api/scheduler/alerts/route.ts`

### Task 7.4: Middleware Integration
- [ ] Buat/modify `app/src/middleware.ts`:
  - Background scheduler tick per request

### Task 7.5: Notification Expansion
- [ ] Buat `app/src/lib/discord.ts`
- [ ] Buat `app/src/lib/email.ts` (Resend)
- [ ] Buat `app/src/lib/notifications.ts` (unified dispatcher)

---

## WAVE 8: Viral Alerts UI
*Estimasi: 1-2 hari*
*Dependency: Wave 7*

### Task 8.1: Viral Alerts Page
- [ ] Buat `app/src/app/viral-alerts/page.tsx`
- [ ] Update sidebar dengan badge count
- [ ] Update top-bar notification bell

### Task 8.2: Dashboard Integration
- [ ] Update dashboard page dengan viral alerts section
- [ ] Real-time badge update (polling setiap 30s)

---

## WAVE 9: Advanced Analytics
*Estimasi: 3-4 hari*
*Dependency: Wave 8*

### Task 9.1: Analytics API
- [ ] Buat `app/src/app/api/analytics/route.ts`
- [ ] Install `recharts`

### Task 9.2: Trends Page
- [ ] Buat `app/src/app/trends/page.tsx`:
  - Line charts, bar charts, heatmap
  - Period selector
  - Competitor comparison

### Task 9.3: Intelligence Reports
- [ ] Buat `app/src/lib/report-generator.ts`
- [ ] Buat `app/src/app/api/reports/route.ts`
- [ ] Buat `app/src/app/reports/page.tsx`

---

## WAVE 10: Content Planning Features
*Estimasi: 2-3 hari*
*Dependency: Wave 9*

### Task 10.1: Content Calendar
- [ ] Tambah `content_calendar` table
- [ ] Buat `app/src/app/api/calendar/route.ts`
- [ ] Buat `app/src/app/calendar/page.tsx`

### Task 10.2: Script Versioning
- [ ] Modify scripts table (versioning columns)
- [ ] Buat `app/src/lib/script-variations.ts`
- [ ] Buat `app/src/app/api/scripts/[id]/variations/route.ts`
- [ ] Update scripts page UI

### Task 10.3: Niche Discovery
- [ ] Buat `app/src/lib/niche-discovery.ts`
- [ ] Buat `app/src/app/api/discover/route.ts`
- [ ] Buat `app/src/app/discover/page.tsx`

---

## Summary: Total Estimasi

| Wave | Nama | Estimasi | Priority |
|------|------|----------|----------|
| 0 | Critical Bug Fixes | 1-2 jam | ✅ Done |
| 1 | Settings & Provider Infrastructure | 2-3 hari | 🔴 P1 |
| 2 | Dashboard & Navigation | 2-3 hari | 🔴 P1 |
| 3 | Toast & UX Polish | 1 hari | 🔴 P1 |
| 4 | Onboarding & Config | 2 hari | 🔴 P1 |
| 5 | Creator Management | 2 hari | 🟡 P2 |
| 6 | New Scraping Providers | 2-3 hari | 🟡 P2 |
| 7 | Auto-Scraping Scheduler | 3-4 hari | 🟡 P2 |
| 8 | Viral Alerts UI | 1-2 hari | 🟡 P2 |
| 9 | Advanced Analytics | 3-4 hari | 🟢 P3 |
| 10 | Content Planning | 2-3 hari | 🟢 P3 |

**Total: ~21-30 hari kerja**

---

## New Pages Summary

| Page | Path | Status |
|------|------|--------|
| Dashboard | `/` | NEW (bukan redirect) |
| Viral Alerts | `/viral-alerts` | NEW |
| Trends | `/trends` | NEW |
| Content Calendar | `/calendar` | NEW |
| Reports | `/reports` | NEW |
| Discover | `/discover` | NEW |
| Performance | `/performance` | NEW |
| Onboarding | `/onboarding` | NEW |

## New API Routes Summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/dashboard` | GET | Aggregated stats |
| `/api/settings/providers` | GET/POST | Provider config |
| `/api/settings/test` | POST | Test connection |
| `/api/pipeline/validate` | POST | Pre-run validation |
| `/api/creator-groups` | GET/POST/PUT/DELETE | Group management |
| `/api/scheduler` | GET/POST | Scheduler control |
| `/api/scheduler/alerts` | GET/PATCH/DELETE | Viral alerts |
| `/api/analytics` | GET | Analytics data |
| `/api/calendar` | GET/POST/PUT/DELETE | Content calendar |
| `/api/reports` | GET/POST | Intelligence reports |
| `/api/discover` | POST | Niche discovery |
| `/api/performance` | GET/POST | Performance tracking |
| `/api/search` | GET | Global search |

## New Database Tables Summary

| Table | Purpose |
|-------|---------|
| `creator_groups` | Group creators lintas platform |
| `scheduler_jobs` | Auto-scraping schedule per creator |
| `viral_alerts` | Detected viral content |
| `scheduler_runs` | Scheduler execution history |
| `content_calendar` | Content planning |
| `posted_content` | Performance tracking |

## New Dependencies

```json
{
  "recharts": "^2.x",     // Charts
  "resend": "^3.x",       // Email notifications
  "date-fns": "^3.x"      // Date manipulation untuk calendar
}
```
