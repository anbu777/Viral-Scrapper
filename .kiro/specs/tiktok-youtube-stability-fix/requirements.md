# Requirements Document

## Introduction

Feature ini merupakan perbaikan komprehensif stabilitas platform TikTok dan YouTube Shorts pada aplikasi **Social Media AI** (viral-ig-scraper). Sebelumnya aplikasi hanya berjalan stabil untuk Instagram; TikTok dan YouTube Shorts mengalami berbagai kegagalan intermiten mulai dari analisis video yang error, import URL yang tidak konsisten, filter creator yang tidak cocok, hingga penambahan creator yang sering timeout.

Perbaikan mencakup lima area utama: (1) stabilitas analisis video di halaman Videos, (2) konsistensi import URL manual TikTok/YouTube, (3) tampilan video creator TikTok/YouTube di halaman Videos, (4) keandalan fitur Add Creator untuk TikTok/YouTube, dan (5) penghapusan pipeline legacy yang sudah tidak digunakan.

---

## Glossary

- **System**: Aplikasi Social Media AI (viral-ig-scraper) secara keseluruhan.
- **Analysis_Route**: Handler API di `api/videos/[id]/analysis/route.ts` yang mengorkestrasi download dan analisis video.
- **Gemini_Client**: Modul `gemini-json-analysis.ts` yang memanggil Gemini API dan mengekstrak JSON terstruktur dari respons.
- **Fallback_Builder**: Fungsi `makeFallbackAnalysis` di `quality.ts` yang menghasilkan objek analisis minimal ketika Gemini tidak tersedia.
- **Import_Route**: Handler API di `api/import/instagram-urls/route.ts` yang menerima URL multi-platform dan menyimpannya ke database.
- **Platform_Detector**: Modul `platform-detect.ts` yang mengklasifikasikan URL ke platform Instagram, TikTok, atau YouTube Shorts.
- **Ytdlp_Wrapper**: Modul `ytdlp.ts` yang membungkus pemanggilan CLI `yt-dlp` untuk metadata dan download video.
- **TikTok_Provider**: Modul `tiktok-provider.ts` yang mengimplementasikan scraping creator dan video TikTok.
- **YouTube_Provider**: Modul `youtube-provider.ts` yang mengimplementasikan scraping creator dan video YouTube Shorts.
- **Creator_Route**: Handler API di `api/creators/route.ts` yang mengelola CRUD creator.
- **Videos_Page**: Halaman frontend `videos/page.tsx` yang menampilkan daftar video dengan filter dan sort.
- **Repository**: Modul `db/repositories.ts` yang menyediakan akses data ke SQLite/PostgreSQL via Drizzle ORM.
- **withBackoff**: Fungsi retry dengan exponential backoff di `retry.ts`.
- **yt-dlp**: Tool CLI open-source untuk mengunduh metadata dan video dari TikTok, YouTube, dan platform lain.
- **Safety_Block**: Kondisi di mana Gemini API mengembalikan respons kosong karena konten video melanggar kebijakan keamanan.
- **Alias**: Nama alternatif seorang creator yang disimpan di kolom `aliases` (JSON array) pada tabel creators.
- **Fuzzy_Match**: Pencocokan nama creator dengan normalisasi (lowercase, hapus `@`, `.`, `_`, `-`).
- **vm.tiktok.com**: Domain URL pendek TikTok yang digunakan pada perangkat mobile.
- **Flat_Playlist**: Mode yt-dlp `--flat-playlist` yang mengambil daftar video tanpa mengunduh metadata detail per video.
- **Legacy_Pipeline**: File `pipeline.ts` yang masih mengimpor dari modul CSV lama dan sudah tidak digunakan.

---

## Requirements

### Requirement 1: Stabilitas Analisis Video — Retry dan Error Handling

**User Story:** Sebagai pengguna, saya ingin analisis video TikTok dan YouTube Shorts berhasil secara konsisten, sehingga saya tidak melihat error merah yang tidak informatif di halaman Videos.

#### Acceptance Criteria

1. WHEN `Analysis_Route` menerima permintaan analisis video, THE `Analysis_Route` SHALL mencoba analisis hingga 3 kali menggunakan `withBackoff` sebelum mengembalikan error ke client.
2. WHEN `Gemini_Client` menerima respons kosong dari Gemini API akibat `Safety_Block`, THE `Gemini_Client` SHALL mengembalikan objek `{ outcome: "fallback", error: "..." }` tanpa melempar exception.
3. WHEN `Gemini_Client` gagal mem-parse JSON dari respons Gemini, THE `Gemini_Client` SHALL melempar error yang dapat di-retry oleh `Analysis_Route`.
4. WHEN semua percobaan retry `Analysis_Route` gagal, THE `Analysis_Route` SHALL mengembalikan HTTP 500 dengan pesan error yang deskriptif dan menyimpan `analysisStatus: "failed"` ke database.
5. WHEN `Analysis_Route` tidak berhasil mengunduh video setelah semua fallback (provider → URL refresh → yt-dlp direct), THE `Analysis_Route` SHALL melanjutkan ke analisis teks-only menggunakan metadata video yang tersedia.
6. WHEN analisis teks-only dijalankan, THE `Analysis_Route` SHALL memanggil `analyzeWithProvider` dengan `allowFallback: true` agar tidak langsung melempar error.

---

### Requirement 2: Fallback Analysis yang Informatif

**User Story:** Sebagai pengguna, saya ingin hasil fallback analysis menampilkan ringkasan yang bermakna, sehingga saya tidak melihat string metadata mentah seperti `"@vinconium, 1355265 views, 65430 likes, caption: ..."` di field summary.

#### Acceptance Criteria

1. WHEN `Fallback_Builder` dipanggil dengan parameter `summary` berisi string metadata mentah (format `"@username, N views, ..."`), THE `Fallback_Builder` SHALL mengabaikan string tersebut dan menggunakan nilai default `"Analisis dihasilkan dari metadata yang tersedia."`.
2. WHEN `Fallback_Builder` dipanggil dengan `transcript` yang tidak kosong, THE `Fallback_Builder` SHALL mengisi field `hook` dengan kalimat pertama dari transcript (maksimal 160 karakter).
3. WHEN `Fallback_Builder` dipanggil dengan `transcript` kosong, THE `Fallback_Builder` SHALL mengisi field `hook` dengan string `"Hook tidak tersedia"`.
4. THE `Fallback_Builder` SHALL selalu menghasilkan objek `VideoAnalysis` yang valid sesuai `VideoAnalysisSchema` tanpa field yang bernilai `undefined`.

---

### Requirement 3: Deteksi URL TikTok Mobile (vm.tiktok.com)

**User Story:** Sebagai pengguna, saya ingin bisa mengimpor URL pendek TikTok dari perangkat mobile (format `vm.tiktok.com/XXXXX`), sehingga import tidak gagal dengan error "unrecognized URL".

#### Acceptance Criteria

1. WHEN `Platform_Detector` menerima URL dengan format `vm.tiktok.com/XXXXXXX`, THE `Platform_Detector` SHALL mengklasifikasikannya sebagai platform `"tiktok"`.
2. WHEN `Platform_Detector` menerima URL dengan format `vt.tiktok.com/XXXXXXX`, THE `Platform_Detector` SHALL mengklasifikasikannya sebagai platform `"tiktok"`.
3. WHEN `Platform_Detector` menerima URL TikTok dalam format apapun yang valid, THE `Platform_Detector` SHALL mengekstrak `shortcode` yang tidak kosong dari URL tersebut.
4. FOR ALL URL TikTok yang valid (termasuk `www.tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com`, `m.tiktok.com`), THE `Platform_Detector` SHALL mengembalikan `platform: "tiktok"` (round-trip property: URL valid → deteksi → platform selalu "tiktok").

---

### Requirement 4: Klasifikasi URL YouTube Watch

**User Story:** Sebagai pengguna, saya ingin URL YouTube format `watch?v=` yang merupakan Shorts tetap bisa diimpor dengan benar, sehingga video tidak gagal diproses oleh yt-dlp.

#### Acceptance Criteria

1. WHEN `Platform_Detector` menerima URL `youtube.com/watch?v=VIDEO_ID`, THE `Platform_Detector` SHALL mengklasifikasikannya sebagai platform `"youtube_shorts"` dengan `normalisedUrl` dalam format `https://www.youtube.com/shorts/VIDEO_ID`.
2. WHEN `Import_Route` menerima URL YouTube `watch?v=` yang telah dinormalisasi ke format `/shorts/`, THE `Import_Route` SHALL meneruskan URL yang sudah dinormalisasi ke `Ytdlp_Wrapper` untuk pengambilan metadata.
3. WHEN `Ytdlp_Wrapper` dipanggil dengan URL YouTube Shorts yang valid, THE `Ytdlp_Wrapper` SHALL berhasil mengambil metadata video tanpa error format URL.

---

### Requirement 5: Rate Limiting pada Import URL Paralel

**User Story:** Sebagai pengguna, saya ingin import beberapa URL TikTok/YouTube sekaligus tidak menyebabkan timeout atau throttling dari yt-dlp, sehingga semua URL berhasil diimpor.

#### Acceptance Criteria

1. WHEN `Import_Route` menerima lebih dari 3 URL TikTok atau YouTube dalam satu permintaan, THE `Import_Route` SHALL memproses URL tersebut secara berurutan (sequential) atau dalam batch maksimal 3 URL paralel, bukan semua sekaligus.
2. WHEN `Import_Route` memproses URL secara sequential/batch, THE `Import_Route` SHALL menambahkan jeda minimal 500ms antar batch untuk menghindari rate limiting yt-dlp.
3. WHEN satu URL dalam batch gagal diproses, THE `Import_Route` SHALL melanjutkan pemrosesan URL berikutnya dan melaporkan kegagalan tersebut di field `enrichmentResults` pada respons.
4. THE `Import_Route` SHALL mengembalikan jumlah URL yang berhasil diimpor (`imported`), yang dilewati (`skipped`), dan detail status per URL (`enrichmentResults`) dalam satu respons JSON.

---

### Requirement 6: Retry yang Lebih Robust pada Ytdlp_Wrapper

**User Story:** Sebagai pengguna, saya ingin yt-dlp otomatis mencoba ulang ketika terjadi error sementara (timeout, rate limit 429, koneksi reset), sehingga import tidak langsung gagal pada percobaan pertama.

#### Acceptance Criteria

1. WHEN `Ytdlp_Wrapper` menerima error dengan kode HTTP 429 dari TikTok atau YouTube, THE `Ytdlp_Wrapper` SHALL mencoba ulang permintaan menggunakan `withBackoff` dengan maksimal 4 percobaan.
2. WHEN `Ytdlp_Wrapper` menerima error timeout atau `ECONNRESET`, THE `Ytdlp_Wrapper` SHALL mencoba ulang permintaan menggunakan `withBackoff` dengan maksimal 4 percobaan.
3. WHEN `Ytdlp_Wrapper` menerima error yang mengandung kata kunci `"secondary user ID"` atau `"tiktokuser"`, THE `Ytdlp_Wrapper` SHALL tidak mencoba ulang dan langsung melempar `ProviderError` dengan kode `"VALIDATION_ERROR"`.
4. WHEN semua percobaan retry `Ytdlp_Wrapper` habis, THE `Ytdlp_Wrapper` SHALL melempar error dengan pesan yang menyertakan URL yang gagal dan pesan error asli dari yt-dlp.

---

### Requirement 7: Filter Creator di Halaman Videos Mendukung Karakter Khusus

**User Story:** Sebagai pengguna, saya ingin filter "View Videos" dari halaman Creators menampilkan video creator TikTok/YouTube dengan benar, meskipun nama creator mengandung karakter `-`, `.`, atau `_`.

#### Acceptance Criteria

1. WHEN `Videos_Page` melakukan normalisasi nama creator untuk fuzzy matching, THE `Videos_Page` SHALL menghapus karakter `-`, `.`, dan `_` dari nama creator sebelum membandingkan.
2. WHEN `Videos_Page` menerima parameter `creator` berisi beberapa nama yang dipisahkan koma (dari link "View Videos" dengan alias), THE `Videos_Page` SHALL mencocokkan video yang creator-nya sesuai dengan salah satu nama tersebut setelah normalisasi.
3. WHEN nama creator video yang tersimpan di database berbeda format dengan nama creator di filter (misal: `"creator-name"` vs `"creatorname"`), THE `Videos_Page` SHALL tetap menampilkan video tersebut jika hasil normalisasi keduanya sama.
4. FOR ALL nama creator yang valid, fungsi normalisasi SHALL menghasilkan output yang sama apapun kombinasi karakter `@`, `-`, `.`, `_` yang ada di awal atau tengah nama (idempotence: `norm(norm(x)) == norm(x)`).

---

### Requirement 8: Pemetaan Platform Creator yang Benar di Repository

**User Story:** Sebagai pengguna, saya ingin creator TikTok yang ditambahkan dengan platform `"tiktok"` tetap terbaca sebagai TikTok (bukan Instagram), sehingga routing scraping dan tampilan platform badge benar.

#### Acceptance Criteria

1. WHEN `Repository` membaca baris creator dari database dengan nilai kolom `platform` adalah `"tiktok"`, THE `Repository` SHALL mengembalikan objek `Creator` dengan field `platform: "tiktok"`.
2. WHEN `Repository` membaca baris creator dari database dengan nilai kolom `platform` adalah `"youtube_shorts"`, THE `Repository` SHALL mengembalikan objek `Creator` dengan field `platform: "youtube_shorts"`.
3. WHEN `Repository` membaca baris creator dari database dengan nilai kolom `platform` adalah `"meta"` atau nilai lain yang tidak dikenal, THE `Repository` SHALL mengembalikan objek `Creator` dengan field `platform: "instagram"` sebagai fallback.
4. WHEN `Repository` membaca baris creator dari database dengan nilai kolom `platform` adalah `null` atau kosong, THE `Repository` SHALL mengembalikan objek `Creator` dengan field `platform: "instagram"` sebagai fallback.

---

### Requirement 9: Alias Creator Terisi Saat Add Creator Gagal Scrape Stats

**User Story:** Sebagai pengguna, saya ingin link "View Videos" dari halaman Creators tetap berfungsi meskipun scraping stats creator TikTok/YouTube gagal saat pertama kali ditambahkan.

#### Acceptance Criteria

1. WHEN `Creator_Route` berhasil menyimpan creator baru tetapi scraping stats gagal, THE `Creator_Route` SHALL tetap mengembalikan HTTP 201 dengan field `warning` yang menjelaskan kegagalan scraping.
2. WHEN `TikTok_Provider` berhasil mendeteksi alias dari yt-dlp (nama uploader berbeda dari username input), THE `Creator_Route` SHALL menyimpan alias tersebut ke kolom `aliases` creator di database.
3. WHEN `Creator_Route` menyimpan creator baru tanpa alias (karena scraping gagal), THE `Creator_Route` SHALL menyimpan username asli sebagai satu-satunya identifier sehingga link "View Videos" tetap dapat melakukan fuzzy matching.
4. WHEN `Creator_Route` menerima permintaan tambah creator dengan username yang sudah ada di database (upsert), THE `Creator_Route` SHALL memperbarui data stats tanpa menghapus alias yang sudah tersimpan sebelumnya.

---

### Requirement 10: TikTok Provider — Scraping Stats Tanpa Hydrate Per Video

**User Story:** Sebagai pengguna, saya ingin proses Add Creator TikTok selesai dalam waktu yang wajar (di bawah 60 detik), sehingga tidak terjadi timeout saat menambahkan creator baru.

#### Acceptance Criteria

1. WHEN `TikTok_Provider` memanggil `scrapeCreatorStats`, THE `TikTok_Provider` SHALL menggunakan `listChannelVideosWithProfile` dengan parameter `hydrate: false` untuk menghindari download metadata per video satu per satu.
2. WHEN `TikTok_Provider` menggunakan `hydrate: false`, THE `TikTok_Provider` SHALL menghitung `avgViews30d` dari data `view_count` yang tersedia di flat-playlist tanpa memerlukan hydration.
3. WHEN `TikTok_Provider` tidak dapat menemukan `view_count` di flat-playlist (nilai 0 atau tidak ada), THE `TikTok_Provider` SHALL mengembalikan `avgViews30d: 0` tanpa melempar error.
4. WHEN `TikTok_Provider` gagal resolve handle TikTok (error `"secondary user ID"` atau `"tiktokuser"`), THE `TikTok_Provider` SHALL mengembalikan stats kosong `{ followers: 0, reelsCount30d: 0, avgViews30d: 0 }` dengan log warning, bukan melempar error yang menggagalkan Add Creator.

---

### Requirement 11: YouTube Provider — View Count yang Reliable

**User Story:** Sebagai pengguna, saya ingin statistik rata-rata views creator YouTube Shorts akurat, sehingga saya bisa membandingkan performa creator dengan benar.

#### Acceptance Criteria

1. WHEN `YouTube_Provider` memanggil `scrapeCreatorStats` dan flat-playlist tidak menyertakan `view_count` untuk sebagian video, THE `YouTube_Provider` SHALL mengabaikan video dengan `view_count` bernilai 0 atau tidak ada saat menghitung `avgViews30d`.
2. WHEN `YouTube_Provider` tidak menemukan video dengan `view_count` yang valid, THE `YouTube_Provider` SHALL mengembalikan `avgViews30d: 0` tanpa melempar error.
3. WHEN `YouTube_Provider` gagal mengambil data dari tab `/shorts`, THE `YouTube_Provider` SHALL mencoba tab `/videos` sebagai fallback sebelum mengembalikan stats kosong.
4. WHEN `YouTube_Provider` berhasil mengambil data dari tab `/videos` sebagai fallback, THE `YouTube_Provider` SHALL mencatat log warning yang menjelaskan bahwa fallback ke `/videos` digunakan.

---

### Requirement 12: Deprecasi dan Penghapusan Legacy Pipeline

**User Story:** Sebagai developer, saya ingin file `pipeline.ts` yang masih mengimpor dari modul CSV legacy dihapus atau dinonaktifkan, sehingga tidak ada code path yang menyimpan data ke CSV alih-alih ke database.

#### Acceptance Criteria

1. WHEN `System` menjalankan pipeline scraping, THE `System` SHALL selalu menggunakan `pipeline-runs.ts` (DB-backed) dan tidak pernah memanggil fungsi dari `pipeline.ts` (legacy CSV).
2. IF `pipeline.ts` masih ada di codebase, THEN THE `System` SHALL tidak mengimpor atau memanggil fungsi apapun dari file tersebut di code path yang aktif.
3. WHEN developer menghapus `pipeline.ts`, THE `System` SHALL tetap berjalan normal tanpa error kompilasi atau runtime.
4. THE `System` SHALL menyimpan semua hasil scraping, analisis, dan script ke database (SQLite atau PostgreSQL via Drizzle ORM), bukan ke file CSV.

---

### Requirement 13: Konsistensi Data Creator Lintas Platform

**User Story:** Sebagai pengguna, saya ingin creator yang sama tidak muncul duplikat di database hanya karena perbedaan format nama atau platform, sehingga data tetap bersih.

#### Acceptance Criteria

1. WHEN `Repository` melakukan upsert creator baru, THE `Repository` SHALL menggunakan kombinasi `(platform, username)` sebagai unique key untuk mencegah duplikasi.
2. WHEN `Import_Route` mengimpor video dan mendeteksi `creatorUsername` dari yt-dlp yang berbeda dari nama creator yang tersimpan, THE `Import_Route` SHALL menyimpan nama dari yt-dlp sebagai `creator` pada record video tanpa mengubah data creator yang sudah ada.
3. WHEN `Creator_Route` menerima permintaan refresh stats creator TikTok dan yt-dlp mengembalikan nama uploader yang berbeda, THE `Creator_Route` SHALL menambahkan nama tersebut ke array `aliases` creator tanpa mengganti `username` utama.
4. FOR ALL creator yang memiliki aliases, THE `Videos_Page` SHALL menampilkan video yang creator-nya cocok dengan `username` utama ATAU salah satu alias setelah normalisasi.

---

### Requirement 14: Pelaporan Error yang Informatif ke Pengguna

**User Story:** Sebagai pengguna, saya ingin pesan error yang muncul di UI menjelaskan penyebab kegagalan dan langkah yang bisa diambil, sehingga saya tahu apa yang harus dilakukan selanjutnya.

#### Acceptance Criteria

1. WHEN `Analysis_Route` gagal menganalisis video setelah semua retry habis, THE `Analysis_Route` SHALL mengembalikan pesan error yang menyebutkan platform video, metode download yang dicoba, dan saran tindakan (misal: "Coba import ulang URL video").
2. WHEN `TikTok_Provider` gagal resolve handle karena memerlukan format `tiktokuser:CHANNEL_ID`, THE `TikTok_Provider` SHALL mengembalikan pesan error yang menjelaskan cara mendapatkan `CHANNEL_ID` dan cara menggunakannya.
3. WHEN `Import_Route` melewati URL karena tidak dikenali, THE `Import_Route` SHALL menyertakan URL tersebut di field `skipped` beserta alasan yang spesifik (misal: "URL tidak dikenali sebagai Instagram, TikTok, atau YouTube Shorts").
4. WHEN `Creator_Route` berhasil menyimpan creator tetapi stats scraping gagal, THE `Creator_Route` SHALL mengembalikan field `warning` dengan pesan yang menjelaskan kegagalan dan menyarankan pengguna untuk mencoba refresh stats nanti.
