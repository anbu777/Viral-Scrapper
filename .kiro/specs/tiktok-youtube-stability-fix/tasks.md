# Implementation Plan: tiktok-youtube-stability-fix

## Overview

Perbaikan komprehensif stabilitas platform TikTok dan YouTube Shorts. Berdasarkan audit kode terkini, sebagian besar perbaikan inti (Grup A, B, C) **sudah diimplementasikan** di codebase. Tasks ini berfokus pada:

1. **Verifikasi & hardening** bagian yang sudah ada namun perlu diperkuat
2. **Property-based tests** menggunakan `fast-check` (belum terinstall)
3. **Unit tests** untuk kasus spesifik yang belum tercakup
4. **Legacy cleanup** `pipeline.ts` yang masih diimport aktif

---

## Tasks

- [ ] 1. Setup infrastruktur testing property-based
  - [ ] 1.1 Install `fast-check` sebagai devDependency
    - Jalankan `npm install --save-dev fast-check` di direktori `app/`
    - Verifikasi `fast-check` muncul di `devDependencies` pada `package.json`
    - _Requirements: 2.4, 7.4_

- [ ] 2. Grup A — Verifikasi dan hardening stabilitas analisis
  - [ ] 2.1 Verifikasi `makeFallbackAnalysis` di `lib/quality.ts`
    - Pastikan regex `METADATA_PATTERN` (`/^@\w+,\s*\d+\s*views/i`) sudah ada dan digunakan
    - Pastikan `hook` diisi dari kalimat pertama transcript (split `/[.!?\n]/`) dengan `.slice(0, 160)`
    - Pastikan fallback hook adalah `"Hook tidak tersedia"` (bukan string bahasa Inggris) saat transcript kosong
    - Pastikan semua field `VideoAnalysis` tidak pernah `undefined` (semua ada default)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 Tulis property-based tests untuk `makeFallbackAnalysis` (Property 5 & 6)
    - Buat file `app/src/lib/__tests__/quality.pbt.test.ts`
    - **Property 5: `makeFallbackAnalysis` selalu menghasilkan `VideoAnalysis` yang valid**
      - Gunakan `fc.string()` untuk `transcript` dan `summary`
      - Assert `VideoAnalysisSchema.parse(result)` tidak throw untuk semua kombinasi input
      - `numRuns: 100`
      - **Validates: Requirements 2.4**
    - **Property 6: `makeFallbackAnalysis` mengabaikan string metadata mentah**
      - Generate string metadata dengan `fc.tuple(fc.string({minLength:1}), fc.nat(), fc.nat(), fc.string()).map(([u,v,l,c]) => \`@${u}, ${v} views, ${l} likes, caption: ${c}\`)`
      - Assert `result.summary` tidak match `/^@\w+,\s*\d+\s*views/i`
      - `numRuns: 100`
      - **Validates: Requirements 2.1**
    - **Property 7: `makeFallbackAnalysis` mengisi hook dari transcript**
      - Generate `transcript` non-kosong dengan `fc.string({minLength: 5})`
      - Assert `result.hook !== "Hook tidak tersedia"` dan `result.hook.length <= 160`
      - `numRuns: 100`
      - **Validates: Requirements 2.2**
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 2.3 Verifikasi `gemini-json-analysis.ts` — safety block tidak throw
    - Pastikan blok `if (!raw || !raw.trim())` mengembalikan `{ outcome: "fallback", ... }` tanpa throw
    - Pastikan JSON parse error di-throw (bukan di-swallow) agar `withBackoff` di caller bisa retry
    - Pastikan `catch (error)` di akhir fungsi meneruskan error (`throw error`) bukan menelan
    - _Requirements: 1.2, 1.3_

  - [ ] 2.4 Verifikasi `api/videos/[id]/analysis/route.ts` — retry dan error message
    - Pastikan `withBackoff` membungkus blok Gemini upload + analyze (sudah ada, verifikasi `retries: 2`)
    - Pastikan path text-only menggunakan `allowFallback: true` pada `analyzeWithProvider`
    - Pastikan pesan error di `catch` menyebutkan platform, metode yang dicoba, dan saran tindakan
    - Pastikan `analysisStatus: "failed"` disimpan ke DB saat semua retry habis
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 14.1_

- [ ] 3. Checkpoint A — Pastikan semua tests lulus
  - Jalankan `npm run test` di direktori `app/`
  - Pastikan semua test di `quality.pbt.test.ts` lulus
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan

- [ ] 4. Grup B — Verifikasi konsistensi import URL
  - [ ] 4.1 Verifikasi `lib/platform-detect.ts` — TIKTOK_RE dan normalisasi YouTube
    - Pastikan `TIKTOK_RE` mencakup `vm.` dan `vt.` dalam pattern (sudah ada, verifikasi capture group)
    - Test manual: `detectPlatform("https://vm.tiktok.com/ZMhXXXXXX/")` harus return `platform: "tiktok"` dan `shortcode` tidak kosong
    - Pastikan `YOUTUBE_WATCH_RE` mengembalikan `normalisedUrl: "https://www.youtube.com/shorts/VIDEO_ID"`
    - Pastikan `Import_Route` menggunakan `detected.normalisedUrl` (bukan `item.url` raw) saat memanggil `getVideoMetadata` — sudah ada di `urlForEnrichment`, verifikasi
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2_

  - [ ]* 4.2 Tulis property-based tests untuk `detectPlatform` (Property 3 & 4)
    - Buat file `app/src/lib/__tests__/platform-detect.pbt.test.ts`
    - **Property 3: Deteksi platform TikTok untuk semua format URL valid**
      - Gunakan `fc.constantFrom("www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com")`
      - Kombinasikan dengan `fc.stringMatching(/^[A-Za-z0-9]{6,15}$/)` untuk shortcode
      - Assert `result.platform === "tiktok"` dan `result.shortcode !== ""`
      - `numRuns: 100`
      - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - **Property 4: Normalisasi URL YouTube watch ke format shorts**
      - Generate VIDEO_ID dengan `fc.stringMatching(/^[A-Za-z0-9_-]{11}$/)`
      - Assert `result.normalisedUrl === \`https://www.youtube.com/shorts/${videoId}\``
      - `numRuns: 100`
      - **Validates: Requirements 4.1**
    - _Requirements: 3.1, 3.2, 3.4, 4.1_

  - [ ] 4.3 Verifikasi `api/import/instagram-urls/route.ts` — rate limiting
    - Pastikan `pLimit(3)` sudah digunakan (sudah ada, verifikasi import `p-limit`)
    - Pastikan delay 500ms antar batch sudah ada (`if (idx > 0 && idx % 3 === 0) await delay(500)`)
    - Pastikan URL yang gagal masuk ke `skipped[]` dengan alasan spesifik (bukan string generik)
    - Pastikan respons selalu mengandung field `imported`, `skipped`, dan `enrichmentResults`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 14.3_

  - [ ] 4.4 Verifikasi `lib/providers/ytdlp.ts` — retry dengan `withBackoff`
    - Pastikan `getVideoMetadata` menggunakan `withBackoff` dengan `shouldRetry` yang skip error `"secondary user ID"` dan `"tiktokuser"`
    - Pastikan `listChannelVideosWithProfile` juga menggunakan `withBackoff` dengan logika yang sama
    - Pastikan tidak ada loop retry manual yang duplikat dengan `withBackoff`
    - Verifikasi `retries: 3` pada `getVideoMetadata` dan `retries: 2` pada `listChannelVideosWithProfile`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 5. Checkpoint B — Pastikan semua tests lulus
  - Jalankan `npm run test` di direktori `app/`
  - Pastikan semua test di `platform-detect.pbt.test.ts` lulus
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan

- [ ] 6. Grup C — Verifikasi creator & view videos fix
  - [ ] 6.1 Verifikasi `lib/providers/tiktok-provider.ts` — hydrate dan view count
    - Pastikan `scrapeCreatorStats` memanggil `listChannelVideosWithProfile` dengan `hydrate: false`
    - Pastikan filter `validViews = recent.filter(r => (r.viewCount ?? 0) > 0)` sudah ada
    - Pastikan `VALIDATION_ERROR` ditangkap dan mengembalikan stats kosong `{ followers: 0, reelsCount30d: 0, avgViews30d: 0 }` dengan `console.warn` (bukan throw)
    - Pastikan `detectedAlias` dikembalikan saat yt-dlp resolve nama uploader yang berbeda
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 9.2_

  - [ ] 6.2 Verifikasi `lib/providers/youtube-provider.ts` — view count dan fallback tab
    - Pastikan filter `validItems = listing.items.filter(r => (r.viewCount ?? 0) > 0)` sudah ada
    - Pastikan fallback ke `/videos` tab sudah ada saat `/shorts` gagal
    - Pastikan `console.warn` mencatat bahwa fallback ke `/videos` digunakan
    - Pastikan kedua tab gagal mengembalikan stats kosong (bukan throw)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 6.3 Verifikasi `db/repositories.ts` — `rowToCreator` pemetaan platform
    - Pastikan `validPlatforms` mencakup `"tiktok"`, `"youtube_shorts"`, **dan `"instagram"`** secara eksplisit
    - Kode saat ini: `validPlatforms: string[] = ["tiktok", "youtube_shorts"]` — `"instagram"` hanya sebagai fallback, bukan nilai valid eksplisit
    - Perbaiki: tambahkan `"instagram"` ke array `validPlatforms` agar nilai `"instagram"` di DB tidak jatuh ke fallback path yang sama dengan nilai tidak dikenal
    - Pastikan `null` dan string kosong tetap fallback ke `"instagram"`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 6.4 Tulis property-based tests untuk `rowToCreator` (Property 8 & 9)
    - Buat file `app/src/db/__tests__/repositories.pbt.test.ts`
    - Ekstrak fungsi `rowToCreator` sebagai export atau test via `normalizeUsername` yang sudah di-export
    - **Property 8: `rowToCreator` memetakan platform valid dengan benar**
      - Gunakan `fc.constantFrom("tiktok", "youtube_shorts", "instagram")`
      - Assert `result.platform === inputPlatform`
      - `numRuns: 100`
      - **Validates: Requirements 8.1, 8.2**
    - **Property 9: `rowToCreator` fallback ke instagram untuk platform tidak dikenal**
      - Generate string acak yang bukan `"tiktok"`, `"youtube_shorts"`, atau `"instagram"` menggunakan `fc.string().filter(s => !["tiktok","youtube_shorts","instagram"].includes(s))`
      - Assert `result.platform === "instagram"`
      - Sertakan `null` dan `""` sebagai kasus tambahan
      - `numRuns: 100`
      - **Validates: Requirements 8.3, 8.4**
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 6.5 Verifikasi fungsi `norm` di `app/videos/page.tsx`
    - Pastikan regex `[._-]` sudah mencakup karakter `-` (sudah ada, verifikasi)
    - Pastikan filter creator mendukung comma-separated names dari parameter `creator`
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 6.6 Tulis property-based tests untuk fungsi `norm` (Property 1 & 2)
    - Buat file `app/src/lib/__tests__/norm.pbt.test.ts`
    - Ekstrak fungsi `norm` ke `lib/normalize-username.ts` atau test via `normalizeUsername` yang sudah di-export dari `db/repositories.ts`
    - **Property 1: Fungsi normalisasi idempotent**
      - Generate nama dengan `fc.string().map(s => s.replace(/[^a-zA-Z0-9@._-]/g, ""))`
      - Assert `norm(norm(name)) === norm(name)`
      - `numRuns: 100`
      - **Validates: Requirements 7.4**
    - **Property 2: Normalisasi menghapus semua karakter khusus**
      - Generate nama yang mengandung `@`, `-`, `.`, `_`
      - Assert hasil tidak mengandung karakter `@`, `-`, `.`, `_`
      - `numRuns: 100`
      - **Validates: Requirements 7.1**
    - _Requirements: 7.1, 7.4_

- [ ] 7. Checkpoint C — Pastikan semua tests lulus
  - Jalankan `npm run test` di direktori `app/`
  - Pastikan semua property-based tests lulus
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan

- [ ] 8. Grup D — Legacy pipeline cleanup
  - [ ] 8.1 Audit `lib/pipeline.ts` — cek import aktif
    - Cari semua file yang mengimport dari `"@/lib/pipeline"` atau `"./pipeline"`
    - Temukan: `app/src/app/api/pipeline/route.ts` mengimport `runPipeline` dari `@/lib/pipeline`
    - Verifikasi apakah `api/pipeline/route.ts` masih digunakan oleh UI (cek apakah ada halaman yang memanggil endpoint ini)
    - _Requirements: 12.1, 12.2_

  - [ ] 8.2 Nonaktifkan atau hapus `api/pipeline/route.ts` yang menggunakan legacy pipeline
    - Jika endpoint `api/pipeline` tidak digunakan oleh UI aktif, hapus atau ganti dengan redirect ke `api/pipeline/runs`
    - Jika masih digunakan, tambahkan deprecation notice dan arahkan ke `pipeline-runs.ts`
    - Pastikan tidak ada code path aktif yang memanggil `runPipeline` dari `pipeline.ts`
    - _Requirements: 12.1, 12.2_

  - [ ] 8.3 Tambahkan deprecation notice pada `lib/pipeline.ts`
    - Tambahkan komentar di bagian atas file: `/** @deprecated Gunakan pipeline-runs.ts. File ini akan dihapus. */`
    - Jika `api/pipeline/route.ts` sudah dinonaktifkan, hapus `pipeline.ts` sepenuhnya
    - Verifikasi `npm run typecheck` lulus setelah perubahan
    - _Requirements: 12.1, 12.2, 12.3_

- [ ] 9. Tulis unit tests untuk kasus spesifik
  - [ ] 9.1 Tambahkan unit tests ke `lib/__tests__/quality.pbt.test.ts`
    - Test: `makeFallbackAnalysis("", "")` → `hook === "Hook tidak tersedia"`
    - Test: `makeFallbackAnalysis("Kalimat pertama. Kalimat kedua.", "")` → `hook === "Kalimat pertama"`
    - Test: `makeFallbackAnalysis("A".repeat(200), "")` → `hook.length <= 160`
    - Test: `makeFallbackAnalysis("", "@vinconium, 1355265 views, 65430 likes, caption: test")` → `summary` tidak match `/^@\w+/`
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 9.2 Tambahkan unit tests ke `lib/__tests__/platform-detect.pbt.test.ts`
    - Test: `detectPlatform("https://vm.tiktok.com/ZMhXXXXXX/")` → `platform: "tiktok"`, `shortcode` tidak kosong
    - Test: `detectPlatform("https://vt.tiktok.com/ZSjXXXXXX/")` → `platform: "tiktok"`
    - Test: `detectPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ")` → `platform: "youtube_shorts"`, `normalisedUrl: "https://www.youtube.com/shorts/dQw4w9WgXcQ"`
    - Test: `detectPlatform("https://www.tiktok.com/@username/video/1234567890")` → `platform: "tiktok"`, `shortcode: "1234567890"`
    - _Requirements: 3.1, 3.2, 4.1_

  - [ ]* 9.3 Tulis property-based tests untuk `avgViews30d` (Property 10)
    - Buat file `app/src/lib/__tests__/avg-views.pbt.test.ts`
    - **Property 10: `avgViews30d` hanya menghitung video dengan view count valid**
      - Generate array campuran item dengan `viewCount > 0` dan `viewCount = 0` menggunakan `fc.array(fc.record({ viewCount: fc.oneof(fc.constant(0), fc.nat({max: 1_000_000})) }))`
      - Implementasikan logika filter yang sama dengan provider: `items.filter(r => (r.viewCount ?? 0) > 0)`
      - Assert hasil sama dengan rata-rata manual dari item yang valid saja
      - `numRuns: 100`
      - **Validates: Requirements 10.2, 10.3, 11.1, 11.2**
    - _Requirements: 10.2, 10.3, 11.1, 11.2_

- [ ] 10. Verifikasi akhir dan typecheck
  - [ ] 10.1 Jalankan `npm run typecheck` di direktori `app/`
    - Pastikan tidak ada TypeScript error baru yang diperkenalkan
    - Fix semua type error yang ditemukan
    - _Requirements: 12.3_

  - [ ] 10.2 Jalankan `npm run test` untuk semua tests
    - Pastikan semua unit tests dan property-based tests lulus
    - Pastikan tidak ada test yang sebelumnya lulus menjadi gagal (regresi)
    - _Requirements: semua_

- [ ] 11. Checkpoint Final — Semua tests lulus
  - Jalankan `npm run qa` (lint + typecheck + test + build) di direktori `app/`
  - Pastikan semua tahap lulus tanpa error
  - Tanyakan kepada user jika ada pertanyaan sebelum menyelesaikan

---

## Notes

- Tasks bertanda `*` adalah opsional dan bisa dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirements spesifik untuk traceability
- **Grup A, B, C sudah sebagian besar diimplementasikan** — tasks di sini adalah verifikasi dan hardening
- **Grup D** memerlukan keputusan: apakah `api/pipeline/route.ts` masih digunakan oleh UI?
- Property-based tests memerlukan `fast-check` yang belum terinstall (Task 1.1 harus dikerjakan pertama)
- `normalizeUsername` sudah di-export dari `db/repositories.ts` — bisa digunakan langsung di tests
- Gunakan `vitest run` (bukan `vitest`) untuk single execution tanpa watch mode

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.3", "2.4", "4.1", "4.3", "4.4", "6.1", "6.2", "6.3", "6.5", "8.1"] },
    { "id": 2, "tasks": ["2.2", "4.2", "6.4", "6.6", "9.1", "9.2", "8.2"] },
    { "id": 3, "tasks": ["8.3", "9.3"] },
    { "id": 4, "tasks": ["10.1"] },
    { "id": 5, "tasks": ["10.2"] }
  ]
}
```
