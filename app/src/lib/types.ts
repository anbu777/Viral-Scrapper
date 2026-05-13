export interface Config {
  id: string;
  configName: string;
  creatorsCategory: string;
  analysisInstruction: string;
  newConceptsInstruction: string;
}

export interface Creator {
  id: string;
  /** Source platform — defaults to "instagram" for back-compat. */
  platform: SocialPlatform;
  username: string;
  category: string;
  profilePicUrl: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  lastScrapedAt: string;
  /** Alternative usernames for cross-platform matching (e.g. "timothy_ronald" on YT, "timothyronald" on TikTok). */
  aliases?: string[];
  /** Group ID — used to group same creator across platforms. */
  groupId?: string | null;
}

export interface CreatorGroup {
  id: string;
  name: string;
  canonicalUsername: string;
  avatarUrl: string;
  notes: string;
}

export interface SchedulerJob {
  id: string;
  creatorId: string;
  platform: SocialPlatform;
  intervalMinutes: number;
  lastRunAt?: string | null;
  nextRunAt: string;
  status: "idle" | "running" | "error";
  lastError?: string | null;
  consecutiveErrors: number;
  enabled: boolean;
}

export interface ViralAlert {
  id: string;
  videoId: string;
  creatorId?: string | null;
  creatorUsername: string;
  platform: SocialPlatform;
  viralityScore: number;
  thresholdUsed: number;
  scoreBreakdown?: Record<string, unknown>;
  seen: boolean;
  notified: boolean;
  dismissed: boolean;
  createdAt: string;
}

export interface ContentCalendarEntry {
  id: string;
  scriptId: string | null;
  scheduledDate: string;
  platform: SocialPlatform;
  status: "draft" | "recorded" | "posted" | "cancelled";
  postedUrl?: string | null;
  notes?: string | null;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostedContent {
  id: string;
  scriptId: string | null;
  postedUrl: string;
  platform: SocialPlatform;
  postedAt: string;
  views24h: number;
  views48h: number;
  views7d: number;
  likes7d: number;
  comments7d: number;
  lastCheckedAt?: string | null;
  createdAt: string;
}

export interface IntelligenceReport {
  id: string;
  configName: string;
  periodFrom: string;
  periodTo: string;
  reportJson: string;
  createdAt: string;
}

export interface CreatorStats {
  profilePicUrl: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
}

export interface Video {
  id: string;
  link: string;
  platform?: string;
  shortcode?: string;
  thumbnail: string;
  creator: string;
  caption?: string;
  views: number;
  likes: number;
  comments: number;
  analysis: string;
  analysisJson?: VideoAnalysis;
  newConcepts: string;
  datePosted: string;
  dateAdded: string;
  configName: string;
  scrapeRunId?: string;
  provider?: string;
  starred: boolean;
  selectedForAnalysis?: boolean;
  duration?: number;      // Video length in seconds (from Apify videoDuration)
  videoFileUrl?: string;  // Direct CDN URL of the video file (for audio extraction in clone mode)
  transcript?: string;    // Raw word-for-word spoken transcript (fetched on demand via Gemini)
  viralityScore?: number;
  rankingReason?: string;
  scoreBreakdown?: Record<string, number | string>;
  rawProviderPayload?: unknown;
  /** ok | fallback | failed — set after AI analysis step */
  analysisStatus?: "ok" | "fallback" | "failed" | "";
}

export interface PipelineParams {
  configName: string;
  maxVideos: number;
  topK: number;
  nDays: number;
  scraperProvider?: ScraperProviderName;
  aiProvider?: AiProviderName;
  transcriptProvider?: TranscriptProviderName;
  videoProvider?: VideoProviderName;
  freeMode?: boolean;
  scriptVariants?: ScriptVariant[];
  maxConcurrency?: number;
  qualityGateMode?: "strict" | "balanced" | "off";
  autoAnalysis?: boolean;         // Run Gemini viral-analysis on each video (default: true)
  autoTranscript?: boolean;       // Extract word-for-word spoken transcript via Gemini
  autoGenerateScripts?: boolean;  // Auto-generate scripts for every analyzed video
  autoGenerateVideos?: boolean;   // Auto-queue D-ID video jobs for every generated script
  skipScraping?: boolean;         // Resume mode: skip scrape+analysis, use already-saved videos
}

export interface ActiveTask {
  id: string;
  creator: string;
  step: string;
  views?: number;
}

export interface PipelineProgress {
  status: "idle" | "running" | "completed" | "error";
  phase: "scraping" | "analyzing" | "generating_scripts" | "generating_videos" | "done";
  activeTasks: ActiveTask[];
  creatorsCompleted: number;
  creatorsTotal: number;
  creatorsScraped: number;
  videosAnalyzed: number;
  videosTotal: number;
  scriptsGenerated: number;
  scriptsTotal: number;
  videoJobsQueued: number;
  videoJobsTotal: number;
  errors: string[];
  log: string[];
}

export type ScraperProviderName = "local" | "apify" | "manual" | "meta" | "tiktok" | "youtube";
export type AiProviderName = "ollama" | "gemini" | "claude";
export type TranscriptProviderName = "whisper-local" | "gemini";
export type VideoProviderName = "none" | "fal";
export type ScriptVariant = "safe" | "viral" | "brand_voice";
export type PipelineRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type PipelineStepStatus = "queued" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";
export type ProviderErrorCode =
  | "PROVIDER_AUTH"
  | "RATE_LIMIT"
  | "MEDIA_EXPIRED"
  | "PRIVATE_OR_DELETED"
  | "AI_SCHEMA_INVALID"
  | "AI_PROVIDER_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

/** Supported source platforms for scraped competitor content. */
export type SocialPlatform = "instagram" | "tiktok" | "youtube_shorts";

export interface ScrapedReel {
  platform: SocialPlatform;
  sourcePostUrl: string;
  shortcode: string;
  creatorUsername: string;
  caption: string;
  thumbnailUrl: string;
  videoFileUrl: string | null;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  durationSeconds?: number;
  rawProviderPayload?: unknown;
}

export interface PipelineRun {
  id: string;
  configName: string;
  provider: ScraperProviderName | string;
  status: PipelineRunStatus;
  freeMode: boolean;
  /** Cooperative cancel flag (checked during long runs) */
  cancelRequested?: boolean;
  params: PipelineParams;
  progress: Record<string, unknown>;
  errors: Array<{ code: ProviderErrorCode; message: string; target?: string }>;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStep {
  id: string;
  scrapeRunId: string;
  creatorUsername: string;
  videoId?: string | null;
  status: PipelineStepStatus;
  step: string;
  errorCode?: ProviderErrorCode | null;
  errorMessage?: string | null;
}

export interface ProviderLog {
  id: string;
  provider: string;
  operation: string;
  status: "success" | "error" | "skipped";
  request: unknown;
  response: unknown;
  errorCode?: ProviderErrorCode | null;
  errorMessage?: string | null;
  durationMs: number;
  createdAt: string;
}

export interface VideoAnalysis {
  hook: string;
  summary: string;
  transcript: string;
  ocrText: string;
  visualPattern: string;
  pacing: string;
  formatPattern: string;
  audience: string;
  viralMechanics: string[];
  riskFlags: string[];
  sourceEvidence: string[];
}

export interface GeneratedScriptVariant {
  variant: ScriptVariant;
  title: string;
  hook: string;
  spokenScript: string;
  cta: string;
  estimatedDurationSeconds: number;
  sourceInspiration: string;
  similarityScore: number;
  qualityScore: number;
  imagePrompt: string;
  videoPrompt: string;
}

export interface QualityScore {
  score: number;
  status: "passed" | "warning" | "failed" | "unchecked";
  rubric: Record<string, number | string | boolean>;
}

// ─── Voice Profile ─────────────────────────────────────────────────────────────
export interface VoiceProfile {
  niche: string;
  tone: string;
  targetAudience: string;
  phrases: string;
  avoidPhrases: string;
  contentGoal: string;
  cta: string;
  sampleContent: string;
  heygenAvatarStyle: string;
  avatarUrls?: string[];  // Multiple reference image URLs — first one is used for video generation, all used for future consistency training
}

// ─── Generated Script ──────────────────────────────────────────────────────────
export interface Script {
  id: string;
  videoId: string;
  generationRunId?: string;
  scriptVariant?: ScriptVariant;
  videoCreator: string;
  videoViews: number;
  videoLink: string;
  title: string;
  hook: string;
  script: string;          // Full formatted script (markdown)
  spokenScript?: string;
  cta?: string;
  sourceInspiration?: string;
  similarityScore?: number;
  qualityScore?: number;
  platform: string;        // "instagram" | "tiktok" | "heygen"
  estimatedDuration: string; // e.g. "45-60 seconds"
  estimatedDurationSeconds?: number;
  contentType: string;     // e.g. "Educational", "Storytelling"
  dateGenerated: string;
  starred: boolean;
  // Video generation pipeline
  videoJobId?: string;
  videoStatus?: "idle" | "processing" | "awaiting_approval" | "approved" | "rejected" | "failed";
  videoUrl?: string;
  geminiCheck?: string;    // Gemini Vision consistency verdict
  claudeCheck?: string;    // Claude Vision consistency verdict
  // Prompt library — filled prompts used for this specific video
  imagePrompt?: string;
  videoPrompt?: string;
  // Avatar used to generate this video
  avatarId?: string;
  generatedImageUrl?: string;   // Higgsfield-hosted URL of the generated start-frame image
  videoMode?: "kling3" | "kling2" | "seedance" | "dop" | "motion_control";  // Which model was used
  videoProvider?: "did" | "higgsfield" | "fal"; // Which API owns the videoJobId
  sourceVideoUrl?: string;  // For Video Clone: direct URL of the original scraped video (for audio extraction)
  // Versioning & A/B testing
  parentScriptId?: string | null;
  version?: number;
  abGroup?: string | null;       // "A" | "B" | "C" etc.
  performanceViews?: number;
  performanceTrackedAt?: string | null;
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
export interface AvatarProfile {
  id: string;
  name: string;
  gender: "female" | "male" | "other";
  niche: string;
  voiceId: string;       // ElevenLabs voice ID for this avatar
  createdAt: string;
}

// ─── Prompt Library ────────────────────────────────────────────────────────────
export interface PromptLibrary {
  imagePromptTemplate: string;   // Template with {outfit} and {background} variables
  videoPromptTemplate: string;   // Template with {outfit}, {background}, {motion}, {dialogue} variables
}
