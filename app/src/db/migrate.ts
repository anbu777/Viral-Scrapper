import { getRawDb } from "./client";

const statements = [
  `CREATE TABLE IF NOT EXISTS creators (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL DEFAULT 'instagram',
    username TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'uncategorized',
    profile_pic_url TEXT NOT NULL DEFAULT '',
    followers INTEGER NOT NULL DEFAULT 0,
    reels_count_30d INTEGER NOT NULL DEFAULT 0,
    avg_views_30d INTEGER NOT NULL DEFAULT 0,
    last_scraped_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS creators_platform_username_idx ON creators(platform, username)`,
  `CREATE TABLE IF NOT EXISTS configs (
    id TEXT PRIMARY KEY,
    config_name TEXT NOT NULL UNIQUE,
    creators_category TEXT NOT NULL,
    analysis_instruction TEXT NOT NULL DEFAULT '',
    new_concepts_instruction TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS scrape_runs (
    id TEXT PRIMARY KEY,
    config_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    free_mode INTEGER NOT NULL DEFAULT 1,
    cancel_requested INTEGER NOT NULL DEFAULT 0,
    params_json TEXT NOT NULL DEFAULT '{}',
    progress_json TEXT NOT NULL DEFAULT '{}',
    error_json TEXT NOT NULL DEFAULT '[]',
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL DEFAULT 'instagram',
    source_post_url TEXT NOT NULL,
    shortcode TEXT NOT NULL DEFAULT '',
    thumbnail TEXT NOT NULL DEFAULT '',
    creator TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    analysis TEXT NOT NULL DEFAULT '',
    analysis_json TEXT NOT NULL DEFAULT '{}',
    new_concepts TEXT NOT NULL DEFAULT '',
    date_posted TEXT NOT NULL DEFAULT '',
    date_added TEXT NOT NULL DEFAULT '',
    config_name TEXT NOT NULL DEFAULT '',
    scrape_run_id TEXT,
    provider TEXT NOT NULL DEFAULT 'unknown',
    starred INTEGER NOT NULL DEFAULT 0,
    selected_for_analysis INTEGER NOT NULL DEFAULT 0,
    duration INTEGER,
    video_file_url TEXT,
    transcript TEXT,
    virality_score REAL NOT NULL DEFAULT 0,
    ranking_reason TEXT NOT NULL DEFAULT '',
    score_breakdown_json TEXT NOT NULL DEFAULT '{}',
    raw_provider_payload_json TEXT NOT NULL DEFAULT '{}',
    analysis_status TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(scrape_run_id) REFERENCES scrape_runs(id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS videos_platform_source_post_url_idx ON videos(platform, source_post_url)`,
  `CREATE TABLE IF NOT EXISTS scrape_run_items (
    id TEXT PRIMARY KEY,
    scrape_run_id TEXT NOT NULL,
    creator_username TEXT NOT NULL,
    video_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    step TEXT NOT NULL DEFAULT '',
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(scrape_run_id) REFERENCES scrape_runs(id),
    FOREIGN KEY(video_id) REFERENCES videos(id)
  )`,
  `CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    analysis_json TEXT NOT NULL DEFAULT '{}',
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(video_id) REFERENCES videos(id)
  )`,
  `CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL DEFAULT '',
    generation_run_id TEXT NOT NULL DEFAULT 'legacy',
    script_variant TEXT NOT NULL DEFAULT 'safe',
    video_creator TEXT NOT NULL DEFAULT '',
    video_views INTEGER NOT NULL DEFAULT 0,
    video_link TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    hook TEXT NOT NULL DEFAULT '',
    script TEXT NOT NULL DEFAULT '',
    spoken_script TEXT NOT NULL DEFAULT '',
    cta TEXT NOT NULL DEFAULT '',
    source_inspiration TEXT NOT NULL DEFAULT '',
    similarity_score REAL NOT NULL DEFAULT 0,
    quality_score REAL NOT NULL DEFAULT 0,
    platform TEXT NOT NULL DEFAULT 'instagram',
    estimated_duration TEXT NOT NULL DEFAULT '',
    estimated_duration_seconds INTEGER NOT NULL DEFAULT 0,
    content_type TEXT NOT NULL DEFAULT '',
    date_generated TEXT NOT NULL DEFAULT '',
    starred INTEGER NOT NULL DEFAULT 0,
    video_job_id TEXT,
    video_status TEXT,
    video_url TEXT,
    gemini_check TEXT,
    claude_check TEXT,
    image_prompt TEXT,
    video_prompt TEXT,
    avatar_id TEXT,
    generated_image_url TEXT,
    video_mode TEXT,
    video_provider TEXT,
    source_video_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS scripts_video_variant_run_idx ON scripts(video_id, script_variant, generation_run_id)`,
  `CREATE TABLE IF NOT EXISTS avatars (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'other',
    niche TEXT NOT NULL DEFAULT '',
    voice_id TEXT NOT NULL DEFAULT '',
    profile_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    step TEXT NOT NULL DEFAULT '',
    input_json TEXT NOT NULL DEFAULT '{}',
    output_json TEXT NOT NULL DEFAULT '{}',
    error_code TEXT,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS provider_logs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL,
    request_json TEXT NOT NULL DEFAULT '{}',
    response_json TEXT NOT NULL DEFAULT '{}',
    error_code TEXT,
    error_message TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS quality_scores (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    score REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unchecked',
    rubric_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

function migrateSqliteIncrementalColumns() {
  const db = getRawDb();
  const columns = db.prepare("PRAGMA table_info(videos)").all() as { name: string }[];
  const names = new Set(columns.map((c) => c.name));
  if (!names.has("analysis_status")) {
    db.exec(`ALTER TABLE videos ADD COLUMN analysis_status TEXT NOT NULL DEFAULT ''`);
  }
  const runCols = db.prepare("PRAGMA table_info(scrape_runs)").all() as { name: string }[];
  const runNames = new Set(runCols.map((c) => c.name));
  if (!runNames.has("cancel_requested")) {
    db.exec(`ALTER TABLE scrape_runs ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0`);
  }
  // Add aliases column to creators table if missing
  const creatorCols = db.prepare("PRAGMA table_info(creators)").all() as { name: string }[];
  const creatorNames = new Set(creatorCols.map((c) => c.name));
  if (!creatorNames.has("aliases")) {
    db.exec(`ALTER TABLE creators ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]'`);
  }
}

export function migrateDb() {
  const db = getRawDb();
  const tx = db.transaction(() => {
    for (const statement of statements) db.exec(statement);
  });
  tx();
  migrateSqliteIncrementalColumns();
}
