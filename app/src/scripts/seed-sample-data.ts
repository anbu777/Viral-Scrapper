/**
 * Sample data seed — adds many configs, creators, voice profiles, calendar entries,
 * sample script, prompt library, etc. so the user can test the full feature surface.
 *
 * Idempotent: re-running this script will skip rows that already exist
 * (matched by username+platform for creators, configName for configs).
 *
 * Usage:
 *   cd app
 *   npx tsx src/scripts/seed-sample-data.ts
 */

import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DB_PATH = path.resolve(process.cwd(), "../data/app.db");
if (!existsSync(DB_PATH)) {
  console.error(`✗ Database not found at ${DB_PATH}. Run 'npm run dev' first to initialize.`);
  process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

let added = { configs: 0, creators: 0, calendar: 0, scripts: 0, posted: 0, scheduler: 0, alerts: 0 };
let skipped = { configs: 0, creators: 0, calendar: 0, scripts: 0, posted: 0, scheduler: 0, alerts: 0 };

// ─── 1. Sample Configs (8 niches) ────────────────────────────────────────────

interface ConfigSeed {
  configName: string;
  creatorsCategory: string;
  analysisInstruction: string;
  newConceptsInstruction: string;
}

const SAMPLE_CONFIGS: ConfigSeed[] = [
  {
    configName: "📈 Crypto & Finance Indo",
    creatorsCategory: "crypto",
    analysisInstruction: `Analisa video pendek finance/crypto Indonesia ini untuk pola konten viral.

Fokus pada:
1. **Pola Hook** — Apa yang ada di 3 detik pertama yang membuat orang berhenti scroll?
2. **Sinyal Otoritas** — Bagaimana kreator membangun kredibilitas (angka, screen recording, chart)?
3. **Density Informasi** — Bagaimana info finansial yang kompleks disederhanakan?
4. **Trigger Emosional** — FOMO, takut rugi, urgency, peluang
5. **Style CTA** — Bagaimana video diakhiri? Subscribe, comment, save?
6. **Format Visual** — Talking head, screen recording, B-roll, text overlay
7. **Pacing** — Density kata per detik, frekuensi cut

Output struktur lengkap: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience, viralMechanics array, riskFlags, sourceEvidence.`,
    newConceptsInstruction: `Berdasarkan analisis video viral finance ini, generate 3 konsep BARU yang adapted dengan:
1. Pola hook yang sama tapi topik angle berbeda
2. Pertahankan sinyal otoritas dan format visual
3. Achievable untuk kreator finance personal (bukan butuh akses institusional)
4. Punya takeaway yang jelas dan actionable
5. Akhiri dengan CTA kuat sesuai audience

Untuk tiap konsep, berikan: title, hook (3 detik pertama), main script (45-60 detik), CTA, dan key visuals.`,
  },
  {
    configName: "💄 Beauty Indonesia",
    creatorsCategory: "beauty",
    analysisInstruction: `Analisa video pendek beauty/lifestyle untuk pola viral.

Fokus pada:
1. **Visual Hook** — Reveal before/after, transformation moment, produk surprising
2. **Aesthetic** — Color palette, lighting, set design, product placement
3. **Pacing** — Quick cuts vs slow reveal, beat drop, ritme visual
4. **Trust Signals** — Tekstur kulit, hasil real, mention ingredient
5. **Identifikasi Audience** — Siapa target speakernya?
6. **Integrasi Tren** — Sound, format, challenge yang sedang trending
7. **Style Voiceover** — ASMR, conversational, edukasi

Output: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience, viralMechanics, riskFlags, sourceEvidence.`,
    newConceptsInstruction: `Generate 3 konsep beauty BARU dengan:
1. Visual hook pattern sama tapi produk/look beda
2. Pertahankan aesthetic dan pacing
3. Achievable dengan produk consumer dan setup rumahan
4. Include peluang product placement yang jelas
5. CTA yang relatable dengan audience-specific

Tiap konsep: title, hook, main script (30-45 detik), CTA, key visuals/produk.`,
  },
  {
    configName: "🤖 AI Tools & Productivity",
    creatorsCategory: "AI",
    analysisInstruction: `Analisa video tech/AI untuk pola viral.

Fokus pada:
1. **Mind-Blow Moment** — Apa reveal "wait, itu bisa?"
2. **Demo Quality** — Real screen recording vs explanation, kecepatan hasil
3. **Practical Application** — Apakah use case jelas dan immediately applicable?
4. **Authority** — Bagaimana kreator establish tech expertise?
5. **Stakes** — Kenapa viewer harus care SEKARANG (FOMO new tool)?
6. **Tutorial Format** — Step-by-step vs overview vs comparison
7. **Tools Disebutkan** — Software, AI model, website spesifik

Output struktur: hook, summary, transcript, ocrText (nama tool/URL terlihat), visualPattern, pacing, formatPattern, audience, viralMechanics, riskFlags, sourceEvidence.`,
    newConceptsInstruction: `Generate 3 konsep tech/AI BARU dengan:
1. Mind-blow hook sama tapi tools/AI features berbeda
2. Pertahankan format demo-driven
3. Showcase aplikasi praktis yang langsung bisa dipakai
4. Include mention tool/website spesifik
5. CTA next-step yang jelas (try sekarang, follow, save)

Tiap konsep: title, hook, main script (30-60 detik dengan timestamp untuk screen demo), CTA, tools needed.`,
  },
  {
    configName: "🏠 Real Estate Indo",
    creatorsCategory: "realestate",
    analysisInstruction: `Analisa video real estate untuk pola viral.

Fokus pada:
1. **Visual Reveal** — Apakah ada room reveal, before/after, surprise feature?
2. **Numerical Hooks** — Harga, ROI, cash flow, square footage
3. **Authority** — License agent, portfolio, deal yang sudah dilakukan
4. **Pacing** — Quick walkthrough vs slow detailed tour
5. **Audience** — First-time buyer, investor, agent, browser
6. **Format** — Tour, market analysis, deal breakdown, education

Output struktur lengkap: hook, summary, transcript, ocrText (angka, harga), visualPattern, pacing, formatPattern, audience, viralMechanics, riskFlags, sourceEvidence.`,
    newConceptsInstruction: `Generate 3 konsep real estate BARU dengan:
1. Visual hook sama tapi property type beda
2. Include numerical hook spesifik
3. Pertahankan authority dan format style
4. CTA yang sesuai audience (DM saya, follow, save)

Tiap konsep: title, hook, main script (45-60 detik), CTA, visuals/property needed.`,
  },
  {
    configName: "💪 Fitness & Health",
    creatorsCategory: "fitness",
    analysisInstruction: `Analisa video fitness/health untuk pola viral.

Fokus:
1. **Body Hook** — Transformation reveal, exercise tutorial, before/after
2. **Trust Signals** — Form, equipment, scientific reasoning
3. **Practical Demo** — Bisa di-replicate viewer di rumah/gym?
4. **Pacing** — Slow form breakdown vs quick montage
5. **Audience** — Beginner, intermediate, advanced
6. **Format** — Tutorial, motivation, myth-busting, transformation

Output: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience, viralMechanics, riskFlags, sourceEvidence.`,
    newConceptsInstruction: `Generate 3 konsep fitness BARU dengan:
1. Body hook pattern sama tapi exercise/topik beda
2. Pertahankan trust signal dan demo quality
3. Achievable dengan equipment minimal
4. CTA yang motivational

Tiap konsep: title, hook, script (30-45 detik), CTA, equipment needed.`,
  },
  {
    configName: "📚 Education & Self-Improvement",
    creatorsCategory: "education",
    analysisInstruction: `Analisa video edukasi/self-improvement untuk pola viral.

Fokus:
1. **Cognitive Hook** — Question, controversial statement, surprising fact
2. **Information Architecture** — Bagaimana konsep kompleks dibreakdown?
3. **Authority** — Credential, source citation, personal experience
4. **Memorability** — Frameworks, acronym, visual metaphor
5. **Audience** — Student, professional, lifelong learner
6. **Format** — Explainer, list, story, debate

Output: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience, viralMechanics, riskFlags, sourceEvidence.`,
    newConceptsInstruction: `Generate 3 konsep edukasi BARU dengan:
1. Cognitive hook sama tapi topik beda
2. Pertahankan information architecture
3. Include framework/acronym memorable
4. CTA learning-focused (save, share, follow)

Tiap konsep: title, hook, script (45-60 detik), CTA, key visuals.`,
  },
  {
    configName: "🚀 Startup & Entrepreneurship",
    creatorsCategory: "startup",
    analysisInstruction: `Analisa video startup/business untuk pola viral.

Fokus:
1. **Story Hook** — Personal anecdote, founder journey, lesson learned
2. **Authority** — Revenue numbers, exit, public profile
3. **Practical Insight** — Apakah ada actionable takeaway?
4. **Pacing** — Story-driven slow burn vs quick punch
5. **Audience** — Aspiring founder, current operator, investor
6. **Format** — Story, lesson, breakdown, contrarian take

Output: hook, summary, transcript, ocrText (revenue, metric), visualPattern, pacing, formatPattern, audience, viralMechanics, riskFlags, sourceEvidence.`,
    newConceptsInstruction: `Generate 3 konsep startup BARU dengan:
1. Story hook structure sama tapi case study beda
2. Pertahankan authority dan practical insight
3. Include numbers/metric spesifik
4. CTA business-oriented (DM, comment your story, follow)

Tiap konsep: title, hook, script (45-60 detik), CTA, key visuals/B-roll.`,
  },
  {
    configName: "🎯 Format Pattern Hunter (Universal)",
    creatorsCategory: "general",
    analysisInstruction: `Analisa video viral apapun untuk extract pattern UNIVERSAL yang bisa diadaptasi ke niche manapun.

Fokus pada META-PATTERN:
1. **Hook Architecture** — Question, statement, visual surprise, character intro
2. **Retention Pattern** — Bagaimana viewer di-keep watching tiap 5 detik?
3. **Reward Pattern** — Apa "payoff" yang viewer dapat di akhir?
4. **Universal Format** — Framework yang bisa diisi konten apapun
5. **Emotional Arc** — Curiosity → tension → resolution
6. **Production Style** — Editing complexity, audio design, visual hierarchy
7. **Replicability Score** — 1-10, seberapa mudah pattern ini di-clone

Output extra detail: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience, viralMechanics, riskFlags, sourceEvidence.`,
    newConceptsInstruction: `Generate 3 konsep adapted yang menggunakan META-PATTERN tapi dengan TOPIK BERBEDA TOTAL dari source.

Goal: prove that the pattern itself is what's viral, not the topic.

Tiap konsep harus:
1. Topik yang relevan dengan niche brand
2. Pertahankan hook architecture, retention pattern, reward pattern
3. Adapt emotional arc ke konteks baru
4. Include script word-for-word

Tiap konsep: title, hook, script (45-60 detik), CTA, production notes.`,
  },
];

console.log("\n[1/7] Seeding configs…");
for (const cfg of SAMPLE_CONFIGS) {
  const exists = db.prepare("SELECT id FROM configs WHERE config_name = ?").get(cfg.configName) as { id: string } | undefined;
  if (exists) {
    skipped.configs += 1;
    continue;
  }
  db.prepare(`
    INSERT INTO configs (id, config_name, creators_category, analysis_instruction, new_concepts_instruction, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), cfg.configName, cfg.creatorsCategory, cfg.analysisInstruction, cfg.newConceptsInstruction, now(), now());
  added.configs += 1;
}
console.log(`    + ${added.configs} added, ${skipped.configs} skipped`);

// ─── 2. Sample Creators across platforms ─────────────────────────────────────

interface CreatorSeed {
  username: string;
  platform: "instagram" | "tiktok" | "youtube_shorts";
  category: string;
  followers?: number;
  reelsCount30d?: number;
  avgViews30d?: number;
  aliases?: string[];
}

const SAMPLE_CREATORS: CreatorSeed[] = [
  // Crypto / Finance
  { username: "raoulgmi",          platform: "instagram",      category: "crypto",      followers: 320000, reelsCount30d: 18, avgViews30d: 145000 },
  { username: "anthonypompliano",  platform: "instagram",      category: "crypto",      followers: 1200000, reelsCount30d: 22, avgViews30d: 380000 },
  { username: "cryptobureau",      platform: "tiktok",         category: "crypto",      followers: 540000, reelsCount30d: 30, avgViews30d: 220000 },
  { username: "BenjaminCowen",     platform: "youtube_shorts", category: "crypto",      followers: 850000, reelsCount30d: 12, avgViews30d: 180000 },

  // AI / Tech
  { username: "matthewberman",     platform: "youtube_shorts", category: "AI",          followers: 280000, reelsCount30d: 25, avgViews30d: 95000, aliases: ["matt_berman_ai"] },
  { username: "ai.curious",        platform: "instagram",      category: "AI",          followers: 180000, reelsCount30d: 28, avgViews30d: 78000 },
  { username: "billyminded",       platform: "tiktok",         category: "AI",          followers: 420000, reelsCount30d: 40, avgViews30d: 165000 },
  { username: "nick.peterson.ai",  platform: "instagram",      category: "AI",          followers: 92000, reelsCount30d: 20, avgViews30d: 45000 },

  // Beauty
  { username: "tashroskin",        platform: "instagram",      category: "beauty",      followers: 760000, reelsCount30d: 32, avgViews30d: 285000 },
  { username: "alixearle",         platform: "tiktok",         category: "beauty",      followers: 7100000, reelsCount30d: 45, avgViews30d: 1850000 },
  { username: "skincarewithhyram", platform: "youtube_shorts", category: "beauty",      followers: 4500000, reelsCount30d: 18, avgViews30d: 920000, aliases: ["hyram", "skincare_hyram"] },

  // Real Estate
  { username: "rosechalousseinfeld", platform: "instagram",    category: "realestate",  followers: 245000, reelsCount30d: 15, avgViews30d: 165000 },
  { username: "graham.stephan",    platform: "youtube_shorts", category: "realestate",  followers: 5200000, reelsCount30d: 28, avgViews30d: 1100000, aliases: ["grahamstephan"] },
  { username: "ericadelarosaa",    platform: "tiktok",         category: "realestate",  followers: 380000, reelsCount30d: 35, avgViews30d: 280000 },

  // Fitness
  { username: "jeffnippard",       platform: "instagram",      category: "fitness",     followers: 2100000, reelsCount30d: 16, avgViews30d: 480000 },
  { username: "athlean.x",         platform: "youtube_shorts", category: "fitness",     followers: 13000000, reelsCount30d: 24, avgViews30d: 1850000, aliases: ["athleanx"] },
  { username: "stephanietuv",      platform: "tiktok",         category: "fitness",     followers: 220000, reelsCount30d: 38, avgViews30d: 145000 },

  // Education / Self-Improvement
  { username: "vsauce",            platform: "youtube_shorts", category: "education",   followers: 19000000, reelsCount30d: 8, avgViews30d: 4200000 },
  { username: "thomas.frank",      platform: "instagram",      category: "education",   followers: 340000, reelsCount30d: 12, avgViews30d: 165000 },
  { username: "studyquill",        platform: "tiktok",         category: "education",   followers: 890000, reelsCount30d: 45, avgViews30d: 320000 },

  // Startup
  { username: "chamath",           platform: "instagram",      category: "startup",     followers: 1800000, reelsCount30d: 6, avgViews30d: 720000 },
  { username: "leveluptalk",       platform: "tiktok",         category: "startup",     followers: 540000, reelsCount30d: 35, avgViews30d: 290000 },
  { username: "alexhormozi",       platform: "youtube_shorts", category: "startup",     followers: 4800000, reelsCount30d: 20, avgViews30d: 1450000 },

  // General format hunter
  { username: "mrbeast",           platform: "youtube_shorts", category: "general",     followers: 250000000, reelsCount30d: 30, avgViews30d: 18500000 },
  { username: "khaby.lame",        platform: "tiktok",         category: "general",     followers: 161000000, reelsCount30d: 50, avgViews30d: 12300000 },
];

console.log("\n[2/7] Seeding creators…");
for (const c of SAMPLE_CREATORS) {
  const exists = db.prepare("SELECT id FROM creators WHERE platform = ? AND username = ?").get(c.platform, c.username) as { id: string } | undefined;
  if (exists) {
    skipped.creators += 1;
    continue;
  }
  db.prepare(`
    INSERT INTO creators (id, platform, username, category, profile_pic_url, followers, reels_count_30d, avg_views_30d, last_scraped_at, aliases, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', ?, ?, ?, '', ?, ?, ?)
  `).run(
    randomUUID(),
    c.platform,
    c.username,
    c.category,
    c.followers || 0,
    c.reelsCount30d || 0,
    c.avgViews30d || 0,
    JSON.stringify(c.aliases || []),
    now(),
    now(),
  );
  added.creators += 1;
}
console.log(`    + ${added.creators} added, ${skipped.creators} skipped`);

// ─── 3. Sample Calendar Entries ──────────────────────────────────────────────

interface CalendarSeed {
  scheduledDate: string;
  platform: "instagram" | "tiktok" | "youtube_shorts";
  status: "draft" | "recorded" | "posted" | "cancelled";
  title: string;
  notes?: string;
  postedUrl?: string;
}

const SAMPLE_CALENDAR: CalendarSeed[] = [
  { scheduledDate: daysFromNow(-3), platform: "instagram",      status: "posted",    title: "3 brutal truths about Bitcoin",                        postedUrl: "https://instagram.com/p/EXAMPLE-1", notes: "Performed well, ~85K views in 24h" },
  { scheduledDate: daysFromNow(-1), platform: "tiktok",         status: "posted",    title: "AI tools that replaced my $5K/month team",             postedUrl: "https://tiktok.com/@me/video/EXAMPLE-2", notes: "Hook A/B tested" },
  { scheduledDate: today(),         platform: "instagram",      status: "recorded",  title: "Why 90% of investors get this wrong",                  notes: "Edited, ready to post tonight" },
  { scheduledDate: today(),         platform: "youtube_shorts", status: "draft",     title: "GPT-5 just changed everything",                        notes: "Need B-roll of OpenAI homepage" },
  { scheduledDate: daysFromNow(1),  platform: "tiktok",         status: "draft",     title: "I tried Bali real estate for 30 days",                 notes: "Story-driven format, 60s" },
  { scheduledDate: daysFromNow(2),  platform: "instagram",      status: "draft",     title: "The morning routine that 10x'd my productivity",       notes: "List format, 5 items" },
  { scheduledDate: daysFromNow(3),  platform: "youtube_shorts", status: "draft",     title: "Coding interview tip nobody talks about",              notes: "Educational, screen demo" },
  { scheduledDate: daysFromNow(5),  platform: "tiktok",         status: "draft",     title: "How $1K became $50K in 18 months",                     notes: "Story hook, finance angle" },
  { scheduledDate: daysFromNow(7),  platform: "instagram",      status: "draft",     title: "5 AI shortcuts every solo founder needs",              notes: "Productivity series Ep. 1" },
  { scheduledDate: daysFromNow(10), platform: "youtube_shorts", status: "draft",     title: "Why I stopped using Excel forever",                    notes: "Tech, contrarian hook" },
  { scheduledDate: daysFromNow(-7), platform: "instagram",      status: "cancelled", title: "Cancelled — old framing didn't fit",                   notes: "Replaced with #2 above" },
];

console.log("\n[3/7] Seeding calendar entries…");
for (const e of SAMPLE_CALENDAR) {
  const exists = db.prepare("SELECT id FROM content_calendar WHERE scheduled_date = ? AND platform = ? AND title = ?").get(e.scheduledDate, e.platform, e.title) as { id: string } | undefined;
  if (exists) {
    skipped.calendar += 1;
    continue;
  }
  db.prepare(`
    INSERT INTO content_calendar (id, script_id, scheduled_date, platform, status, posted_url, notes, title, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), e.scheduledDate, e.platform, e.status, e.postedUrl ?? null, e.notes ?? null, e.title, now(), now());
  added.calendar += 1;
}
console.log(`    + ${added.calendar} added, ${skipped.calendar} skipped`);

// ─── 4. Sample Scripts (1 mock script + variations metadata) ─────────────────

interface ScriptSeed {
  videoCreator: string;
  videoLink: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  contentType: string;
  estimatedDuration: string;
  estimatedDurationSeconds: number;
  platform: string;
  abGroup?: string;
  parentId?: string | null;
}

const sampleScriptId = randomUUID();
const SAMPLE_SCRIPTS: ScriptSeed[] = [
  {
    videoCreator: "alexhormozi",
    videoLink: "https://youtube.com/shorts/SAMPLE-INSPIRATION",
    title: "Why most founders quit at month 18 — and what I learned",
    hook: "Most founders quit at exactly month 18. Here's why — and how I survived it.",
    body: `Most founders quit at exactly month 18. Here's why — and how I survived it.

Month 1 you're high on the idea. Month 6 you start hitting walls. Month 12 the money is running out. Month 18 you're staring at zero traction wondering if you wasted two years of your life.

I almost quit at month 17. The only reason I didn't? I had one customer pay me $500 for something I built in a weekend. That single transaction told me the market existed — I just hadn't found the right wedge yet.

So I burned everything except that one product. Cancelled the side projects. Cut the team to me and one freelancer. And focused obsessively on what that one customer wanted next.

Six months later, that obsession turned into $30K MRR. Today it's $400K MRR.

The lesson: when you're at month 18, don't quit — concentrate. The fact that ONE person paid means it can scale. The math just hasn't caught up yet.

Save this if you're a founder grinding through the dip right now.`,
    cta: "Save this if you're grinding. Follow for raw startup truths.",
    contentType: "Founder Story",
    estimatedDuration: "55 seconds",
    estimatedDurationSeconds: 55,
    platform: "instagram",
    abGroup: "A",
  },
  {
    videoCreator: "alexhormozi",
    videoLink: "https://youtube.com/shorts/SAMPLE-INSPIRATION",
    title: "Why most founders quit at month 18 — Question Hook variant",
    hook: "Did you know 87% of founders quit at exactly month 18?",
    body: `Did you know 87% of founders quit at exactly month 18?

I almost did. And looking back, I'm shocked at how predictable the timeline was.

Month 1 you're high on the idea. Month 6 you hit walls. Month 12 the money runs out. Month 18 you're staring at zero traction wondering if you wasted two years.

The reason I didn't quit? One customer paid me $500 for something I made in a weekend. That single transaction proved the market existed — I just hadn't found the right wedge.

So I burned everything except that product. Cancelled side projects. Cut the team to me + one freelancer. Obsessed over what that one customer wanted next.

Six months later: $30K MRR. Today: $400K MRR.

When you're at month 18, don't quit — concentrate.`,
    cta: "Comment 'survived' if you're past month 18.",
    contentType: "Founder Story",
    estimatedDuration: "55 seconds",
    estimatedDurationSeconds: 55,
    platform: "instagram",
    abGroup: "B",
    parentId: sampleScriptId,
  },
];

console.log("\n[4/7] Seeding sample scripts…");
{
  // First script gets a fixed id so the variant can reference it
  const existing = db.prepare("SELECT id FROM scripts WHERE title = ?").get(SAMPLE_SCRIPTS[0].title) as { id: string } | undefined;
  if (existing) {
    skipped.scripts += SAMPLE_SCRIPTS.length;
  } else {
    for (let i = 0; i < SAMPLE_SCRIPTS.length; i++) {
      const s = SAMPLE_SCRIPTS[i];
      const id = i === 0 ? sampleScriptId : randomUUID();
      const parentId = i === 0 ? null : sampleScriptId;
      db.prepare(`
        INSERT INTO scripts (
          id, video_id, generation_run_id, script_variant, video_creator, video_views, video_link,
          title, hook, script, spoken_script, cta, source_inspiration, similarity_score, quality_score,
          platform, estimated_duration, estimated_duration_seconds, content_type, date_generated, starred,
          parent_script_id, version, ab_group, performance_views, performance_tracked_at,
          created_at, updated_at
        ) VALUES (?, '', ?, 'safe', ?, 0, ?, ?, ?, ?, ?, ?, '', 0.85, 92, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, NULL, ?, ?)
      `).run(
        id,
        `seed_${i + 1}_${Date.now()}`,
        s.videoCreator,
        s.videoLink,
        s.title,
        s.hook,
        s.body, // script (md)
        s.body, // spoken_script
        s.cta,
        s.platform,
        s.estimatedDuration,
        s.estimatedDurationSeconds,
        s.contentType,
        today(),
        parentId,
        i === 0 ? 1 : 2,
        s.abGroup ?? null,
        now(),
        now(),
      );
      added.scripts += 1;
    }
  }
}
console.log(`    + ${added.scripts} added, ${skipped.scripts} skipped`);

// ─── 5. Sample Posted Content (performance tracking) ─────────────────────────

const SAMPLE_POSTED = [
  {
    postedUrl: "https://instagram.com/p/SAMPLE-PERF-1",
    platform: "instagram",
    postedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    views24h: 8500,
    views48h: 14200,
    views7d: 52800,
    likes7d: 4200,
    comments7d: 280,
  },
  {
    postedUrl: "https://tiktok.com/@me/video/SAMPLE-PERF-2",
    platform: "tiktok",
    postedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    views24h: 32000,
    views48h: 78000,
    views7d: 245000,
    likes7d: 18500,
    comments7d: 920,
  },
  {
    postedUrl: "https://youtube.com/shorts/SAMPLE-PERF-3",
    platform: "youtube_shorts",
    postedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    views24h: 12000,
    views48h: 28000,
    views7d: 95000,
    likes7d: 6800,
    comments7d: 410,
  },
];

console.log("\n[5/7] Seeding posted content (performance tracker)…");
for (const p of SAMPLE_POSTED) {
  const exists = db.prepare("SELECT id FROM posted_content WHERE posted_url = ?").get(p.postedUrl) as { id: string } | undefined;
  if (exists) {
    skipped.posted += 1;
    continue;
  }
  db.prepare(`
    INSERT INTO posted_content (id, script_id, posted_url, platform, posted_at, views_24h, views_48h, views_7d, likes_7d, comments_7d, last_checked_at, created_at)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), p.postedUrl, p.platform, p.postedAt, p.views24h, p.views48h, p.views7d, p.likes7d, p.comments7d, now(), now());
  added.posted += 1;
}
console.log(`    + ${added.posted} added, ${skipped.posted} skipped`);

// ─── 6. Sample Scheduler Jobs (auto-scrape per creator) ──────────────────────

console.log("\n[6/7] Seeding scheduler jobs…");
{
  // Pick top 5 creators with highest avgViews to schedule
  const topCreators = db
    .prepare("SELECT id, platform FROM creators ORDER BY avg_views_30d DESC LIMIT 5")
    .all() as Array<{ id: string; platform: string }>;
  for (const c of topCreators) {
    const exists = db.prepare("SELECT id FROM scheduler_jobs WHERE creator_id = ? AND platform = ?").get(c.id, c.platform) as { id: string } | undefined;
    if (exists) {
      skipped.scheduler += 1;
      continue;
    }
    db.prepare(`
      INSERT INTO scheduler_jobs (id, creator_id, platform, interval_minutes, last_run_at, next_run_at, status, last_error, consecutive_errors, enabled, created_at, updated_at)
      VALUES (?, ?, ?, 360, NULL, ?, 'idle', NULL, 0, 1, ?, ?)
    `).run(randomUUID(), c.id, c.platform, new Date(Date.now() + 10 * 60_000).toISOString(), now(), now());
    added.scheduler += 1;
  }
}
console.log(`    + ${added.scheduler} added, ${skipped.scheduler} skipped`);

// ─── 7. Voice Profile + Prompt Library (file-based) ──────────────────────────

console.log("\n[7/7] Seeding voice profile + prompt library…");

const dataDir = path.resolve(process.cwd(), "../data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const voiceProfilePath = path.join(dataDir, "voice-profile.json");
if (!existsSync(voiceProfilePath)) {
  const voiceProfile = {
    niche: "Tech & AI Productivity",
    tone: "authoritative, direct, slightly contrarian — speaks like an experienced operator who has actually shipped products",
    targetAudience: "Indie hackers, solopreneurs, and tech-curious knowledge workers age 22-40",
    phrases: "Look, here's the thing | The reality is | Most people miss this | Real talk",
    avoidPhrases: "literally | basically | super important | mind-blowing",
    contentGoal: "Build authority in AI/productivity niche, drive Twitter and newsletter signups",
    cta: "Save this and follow for daily AI workflow tips",
    sampleContent: `Hook: 'Most people use ChatGPT wrong. Here's the prompt structure that 10x'd my output.'

Body: I used to write paragraphs of context every time. Then I learned the 4-part structure used by every AI consultant: Role + Task + Context + Format. Role tells the model who to BE. Task tells it what to DO. Context gives constraints. Format dictates the output. Once I structured every prompt this way, my hit rate went from 30% to 90%.

CTA: Save this. Follow for the prompts I use daily.`,
    heygenAvatarStyle: "professional but approachable, business casual, direct camera eye contact",
    avatarUrls: [],
  };
  writeFileSync(voiceProfilePath, JSON.stringify(voiceProfile, null, 2));
  console.log(`    + voice-profile.json created`);
} else {
  console.log(`    - voice-profile.json already exists, skipping`);
}

const promptLibPath = path.join(dataDir, "prompt-library.json");
if (!existsSync(promptLibPath)) {
  const promptLibrary = {
    imagePromptTemplate: `Cinematic portrait photograph of {avatar_name}, wearing {outfit}, {background} background, professional studio lighting with soft key light from front-left, shallow depth of field f/2.8, 85mm lens, sharp focus on eyes, neutral expression, natural skin texture, hyperrealistic, 4K, color graded with warm cinematic tones`,
    videoPromptTemplate: `{avatar_name} in {outfit} stands centered in a {background} setting, speaking directly to camera with engaging facial expressions and natural hand gestures. {motion}. Spoken dialogue: "{dialogue}". The camera holds a steady medium shot for the duration. Lighting is soft and cinematic. Mouth movement is perfectly synced to the dialogue. Subject maintains direct eye contact with viewer.`,
  };
  writeFileSync(promptLibPath, JSON.stringify(promptLibrary, null, 2));
  console.log(`    + prompt-library.json created`);
} else {
  console.log(`    - prompt-library.json already exists, skipping`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(60));
console.log("  ✓ SEED COMPLETE");
console.log("=".repeat(60));
console.log(`Configs:    +${added.configs} added, ${skipped.configs} skipped`);
console.log(`Creators:   +${added.creators} added, ${skipped.creators} skipped`);
console.log(`Calendar:   +${added.calendar} added, ${skipped.calendar} skipped`);
console.log(`Scripts:    +${added.scripts} added, ${skipped.scripts} skipped`);
console.log(`Posted:     +${added.posted} added, ${skipped.posted} skipped`);
console.log(`Scheduler:  +${added.scheduler} added, ${skipped.scheduler} skipped`);
console.log(`Voice/Prompt: file-based, see above`);
console.log("\nNext steps:");
console.log("  1. Open http://localhost:3001 to see the new data");
console.log("  2. Visit /trends, /reports, /calendar, /performance for the new sections");
console.log("  3. Try generating script variations on the seeded sample script");
console.log("  4. Run pipeline on any of the new configs (requires API keys)");
console.log("=".repeat(60));

db.close();
