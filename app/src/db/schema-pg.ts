import { relations, sql } from "drizzle-orm";
import { boolean, integer, pgTable, real, text, uniqueIndex } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)::text`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)::text`),
};

export const creators = pgTable("creators", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull().default("instagram"),
  username: text("username").notNull(),
  category: text("category").notNull().default("uncategorized"),
  profilePicUrl: text("profile_pic_url").notNull().default(""),
  followers: integer("followers").notNull().default(0),
  reelsCount30d: integer("reels_count_30d").notNull().default(0),
  avgViews30d: integer("avg_views_30d").notNull().default(0),
  lastScrapedAt: text("last_scraped_at").notNull().default(""),
  aliases: text("aliases").notNull().default("[]"),
  ...timestamps,
}, (table) => ({
  uniqCreator: uniqueIndex("creators_platform_username_idx").on(table.platform, table.username),
}));

export const configs = pgTable("configs", {
  id: text("id").primaryKey(),
  configName: text("config_name").notNull().unique(),
  creatorsCategory: text("creators_category").notNull(),
  analysisInstruction: text("analysis_instruction").notNull().default(""),
  newConceptsInstruction: text("new_concepts_instruction").notNull().default(""),
  ...timestamps,
});

export const scrapeRuns = pgTable("scrape_runs", {
  id: text("id").primaryKey(),
  configName: text("config_name").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("queued"),
  freeMode: boolean("free_mode").notNull().default(true),
  cancelRequested: boolean("cancel_requested").notNull().default(false),
  paramsJson: text("params_json").notNull().default("{}"),
  progressJson: text("progress_json").notNull().default("{}"),
  errorJson: text("error_json").notNull().default("[]"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  ...timestamps,
});

export const videos = pgTable("videos", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull().default("instagram"),
  sourcePostUrl: text("source_post_url").notNull(),
  shortcode: text("shortcode").notNull().default(""),
  thumbnail: text("thumbnail").notNull().default(""),
  creator: text("creator").notNull(),
  caption: text("caption").notNull().default(""),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  analysis: text("analysis").notNull().default(""),
  analysisJson: text("analysis_json").notNull().default("{}"),
  newConcepts: text("new_concepts").notNull().default(""),
  datePosted: text("date_posted").notNull().default(""),
  dateAdded: text("date_added").notNull().default(""),
  configName: text("config_name").notNull().default(""),
  scrapeRunId: text("scrape_run_id").references(() => scrapeRuns.id),
  provider: text("provider").notNull().default("unknown"),
  starred: boolean("starred").notNull().default(false),
  selectedForAnalysis: boolean("selected_for_analysis").notNull().default(false),
  duration: integer("duration"),
  videoFileUrl: text("video_file_url"),
  transcript: text("transcript"),
  viralityScore: real("virality_score").notNull().default(0),
  rankingReason: text("ranking_reason").notNull().default(""),
  scoreBreakdownJson: text("score_breakdown_json").notNull().default("{}"),
  rawProviderPayloadJson: text("raw_provider_payload_json").notNull().default("{}"),
  analysisStatus: text("analysis_status").notNull().default(""),
  ...timestamps,
}, (table) => ({
  uniqVideo: uniqueIndex("videos_platform_source_post_url_idx").on(table.platform, table.sourcePostUrl),
}));

export const scrapeRunItems = pgTable("scrape_run_items", {
  id: text("id").primaryKey(),
  scrapeRunId: text("scrape_run_id").notNull().references(() => scrapeRuns.id),
  creatorUsername: text("creator_username").notNull(),
  videoId: text("video_id").references(() => videos.id),
  status: text("status").notNull().default("queued"),
  step: text("step").notNull().default(""),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const analysisRuns = pgTable("analysis_runs", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("queued"),
  analysisJson: text("analysis_json").notNull().default("{}"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const scripts = pgTable("scripts", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().default(""),
  generationRunId: text("generation_run_id").notNull().default("legacy"),
  scriptVariant: text("script_variant").notNull().default("safe"),
  videoCreator: text("video_creator").notNull().default(""),
  videoViews: integer("video_views").notNull().default(0),
  videoLink: text("video_link").notNull().default(""),
  title: text("title").notNull().default(""),
  hook: text("hook").notNull().default(""),
  script: text("script").notNull().default(""),
  spokenScript: text("spoken_script").notNull().default(""),
  cta: text("cta").notNull().default(""),
  sourceInspiration: text("source_inspiration").notNull().default(""),
  similarityScore: real("similarity_score").notNull().default(0),
  qualityScore: real("quality_score").notNull().default(0),
  platform: text("platform").notNull().default("instagram"),
  estimatedDuration: text("estimated_duration").notNull().default(""),
  estimatedDurationSeconds: integer("estimated_duration_seconds").notNull().default(0),
  contentType: text("content_type").notNull().default(""),
  dateGenerated: text("date_generated").notNull().default(""),
  starred: boolean("starred").notNull().default(false),
  videoJobId: text("video_job_id"),
  videoStatus: text("video_status"),
  videoUrl: text("video_url"),
  geminiCheck: text("gemini_check"),
  claudeCheck: text("claude_check"),
  imagePrompt: text("image_prompt"),
  videoPrompt: text("video_prompt"),
  avatarId: text("avatar_id"),
  generatedImageUrl: text("generated_image_url"),
  videoMode: text("video_mode"),
  videoProvider: text("video_provider"),
  sourceVideoUrl: text("source_video_url"),
  ...timestamps,
}, (table) => ({
  uniqScriptVariant: uniqueIndex("scripts_video_variant_run_idx").on(table.videoId, table.scriptVariant, table.generationRunId),
}));

export const avatars = pgTable("avatars", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  gender: text("gender").notNull().default("other"),
  niche: text("niche").notNull().default(""),
  voiceId: text("voice_id").notNull().default(""),
  profileJson: text("profile_json").notNull().default("{}"),
  ...timestamps,
});

export const generationJobs = pgTable("generation_jobs", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("queued"),
  step: text("step").notNull().default(""),
  inputJson: text("input_json").notNull().default("{}"),
  outputJson: text("output_json").notNull().default("{}"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  ...timestamps,
});

export const providerLogs = pgTable("provider_logs", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  operation: text("operation").notNull(),
  status: text("status").notNull(),
  requestJson: text("request_json").notNull().default("{}"),
  responseJson: text("response_json").notNull().default("{}"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms").notNull().default(0),
  ...timestamps,
});

export const qualityScores = pgTable("quality_scores", {
  id: text("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  score: real("score").notNull().default(0),
  status: text("status").notNull().default("unchecked"),
  rubricJson: text("rubric_json").notNull().default("{}"),
  ...timestamps,
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull().default("{}"),
  ...timestamps,
});

export const videosRelations = relations(videos, ({ many }) => ({
  scripts: many(scripts),
  analysisRuns: many(analysisRuns),
}));

export const scriptsRelations = relations(scripts, ({ one }) => ({
  video: one(videos, {
    fields: [scripts.videoId],
    references: [videos.id],
  }),
}));
