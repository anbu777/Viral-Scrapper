import path from "path";
import { z } from "zod";

const EnvSchema = z.object({
  SCRAPER_PROVIDER: z.enum(["local", "apify", "manual", "meta", "tiktok", "youtube"]).default("manual"),
  /** Default cloud free path: Gemini API (no local LLM). */
  AI_PROVIDER: z.enum(["ollama", "gemini", "claude"]).default("gemini"),
  TRANSCRIPT_PROVIDER: z.enum(["whisper-local", "gemini"]).default("gemini"),
  VIDEO_PROVIDER: z.enum(["none", "fal"]).default("none"),
  DATABASE_URL: z.string().default("file:../data/app.db"),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:7b-instruct"),
  LOCAL_BROWSER_PROFILE_DIR: z.string().default("../data/browser-profile"),
  YTDLP_COOKIES_PATH: z.string().default("../data/cookies/instagram.txt"),
  APIFY_API_TOKEN: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  /** Must match Telegram setWebhook secret_token; verified in middleware. */
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function getEnv(): AppEnv {
  return EnvSchema.parse(process.env);
}

export function isPostgresDatabaseUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith("postgres://") || u.startsWith("postgresql://");
}

export function getSqlitePath(databaseUrl = getEnv().DATABASE_URL): string {
  const value = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

export function getEnvReport() {
  const env = getEnv();
  return {
    scraperProvider: env.SCRAPER_PROVIDER,
    aiProvider: env.AI_PROVIDER,
    transcriptProvider: env.TRANSCRIPT_PROVIDER,
    videoProvider: env.VIDEO_PROVIDER,
    databaseMode: isPostgresDatabaseUrl(env.DATABASE_URL) ? "postgres" : "sqlite",
    databasePath: isPostgresDatabaseUrl(env.DATABASE_URL) ? "(remote)" : getSqlitePath(env.DATABASE_URL),
    paidKeys: {
      apify: Boolean(env.APIFY_API_TOKEN),
      gemini: Boolean(env.GEMINI_API_KEY),
      claude: Boolean(env.ANTHROPIC_API_KEY),
      fal: Boolean(env.FAL_KEY),
      telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    },
  };
}
