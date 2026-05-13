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
  `CREATE TABLE IF NOT EXISTS creator_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    canonical_username TEXT NOT NULL,
    avatar_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS scheduler_jobs (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL DEFAULT 360,
    last_run_at TEXT,
    next_run_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    last_error TEXT,
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(creator_id) REFERENCES creators(id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS scheduler_jobs_creator_platform_idx ON scheduler_jobs(creator_id, platform)`,
  `CREATE TABLE IF NOT EXISTS viral_alerts (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    creator_id TEXT,
    creator_username TEXT NOT NULL,
    platform TEXT NOT NULL,
    virality_score REAL NOT NULL,
    threshold_used REAL NOT NULL,
    score_breakdown_json TEXT NOT NULL DEFAULT '{}',
    seen INTEGER NOT NULL DEFAULT 0,
    notified INTEGER NOT NULL DEFAULT 0,
    dismissed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(video_id) REFERENCES videos(id)
  )`,
  `CREATE TABLE IF NOT EXISTS scheduler_runs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    videos_found INTEGER NOT NULL DEFAULT 0,
    viral_detected INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(job_id) REFERENCES scheduler_jobs(id)
  )`,
  `CREATE TABLE IF NOT EXISTS content_calendar (
    id TEXT PRIMARY KEY,
    script_id TEXT,
    scheduled_date TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    posted_url TEXT,
    notes TEXT,
    title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS posted_content (
    id TEXT PRIMARY KEY,
    script_id TEXT,
    posted_url TEXT NOT NULL,
    platform TEXT NOT NULL,
    posted_at TEXT NOT NULL,
    views_24h INTEGER NOT NULL DEFAULT 0,
    views_48h INTEGER NOT NULL DEFAULT 0,
    views_7d INTEGER NOT NULL DEFAULT 0,
    likes_7d INTEGER NOT NULL DEFAULT 0,
    comments_7d INTEGER NOT NULL DEFAULT 0,
    last_checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS intelligence_reports (
    id TEXT PRIMARY KEY,
    config_name TEXT NOT NULL DEFAULT '',
    period_from TEXT NOT NULL,
    period_to TEXT NOT NULL,
    report_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  if (!creatorNames.has("group_id")) {
    db.exec(`ALTER TABLE creators ADD COLUMN group_id TEXT`);
  }
  // Add script versioning + A/B testing columns
  const scriptCols = db.prepare("PRAGMA table_info(scripts)").all() as { name: string }[];
  const scriptNames = new Set(scriptCols.map((c) => c.name));
  if (!scriptNames.has("parent_script_id")) {
    db.exec(`ALTER TABLE scripts ADD COLUMN parent_script_id TEXT`);
  }
  if (!scriptNames.has("version")) {
    db.exec(`ALTER TABLE scripts ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  }
  if (!scriptNames.has("ab_group")) {
    db.exec(`ALTER TABLE scripts ADD COLUMN ab_group TEXT`);
  }
  if (!scriptNames.has("performance_views")) {
    db.exec(`ALTER TABLE scripts ADD COLUMN performance_views INTEGER NOT NULL DEFAULT 0`);
  }
  if (!scriptNames.has("performance_tracked_at")) {
    db.exec(`ALTER TABLE scripts ADD COLUMN performance_tracked_at TEXT`);
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
