/**
 * Centralized app settings — provider configuration stored in DB.
 *
 * Resolves settings with this priority:
 *   1. Database `app_settings` table (user-configured via dashboard)
 *   2. Environment variables (.env file)
 *   3. Hard-coded defaults
 *
 * This allows users to change providers, API keys, and schedules from the
 * Settings UI without restarting the server or editing .env.
 */

import { repo } from "@/db/repositories";
import { getEnv } from "@/lib/env";

const SETTINGS_KEY = "providers";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstagramScraperOption = "apify" | "playwright" | "manual";
export type TiktokScraperOption = "apify_tiktok" | "ytdlp";
export type YoutubeScraperOption = "youtube_api" | "ytdlp";
export type AiAnalysisOption = "gemini" | "claude" | "ollama";
export type AiScriptOption = "gemini" | "claude" | "ollama";
export type TtsOption = "edge_tts" | "elevenlabs" | "openai_tts";
export type VideoGenOption = "none" | "fal" | "did";
export type ScheduleInterval = "1h" | "2h" | "4h" | "6h" | "12h" | "24h" | "off";

export interface ProviderSettings {
  scraping: {
    instagram: { provider: InstagramScraperOption; apifyToken?: string };
    tiktok: { provider: TiktokScraperOption; apifyToken?: string };
    youtube: { provider: YoutubeScraperOption; apiKey?: string };
  };
  ai: {
    analysis: { provider: AiAnalysisOption; geminiKey?: string; claudeKey?: string; model?: string };
    scriptGen: { provider: AiScriptOption; geminiKey?: string; claudeKey?: string; model?: string };
    transcript: { provider: "gemini" | "whisper-local"; geminiKey?: string };
  };
  tts: {
    provider: TtsOption;
    voice: string;
    elevenLabsKey?: string;
    elevenLabsVoiceId?: string;
    openaiKey?: string;
  };
  video: {
    provider: VideoGenOption;
    falKey?: string;
    didKey?: string;
    model?: "kling3" | "kling2" | "seedance";
  };
  notifications: {
    telegram: { enabled: boolean; botToken?: string; chatId?: string; webhookSecret?: string };
    discord: { enabled: boolean; webhookUrl?: string };
    email: { enabled: boolean; resendKey?: string; fromEmail?: string; toEmail?: string };
  };
  schedule: {
    instagram: { interval: ScheduleInterval; maxVideos: number; enabled: boolean };
    tiktok: { interval: ScheduleInterval; maxVideos: number; enabled: boolean };
    youtube: { interval: ScheduleInterval; maxVideos: number; enabled: boolean };
    viralThreshold: number; // multiplier above creator baseline
    minViews: number;
  };
}

// ─── Defaults from env ────────────────────────────────────────────────────────

function getDefaultsFromEnv(): ProviderSettings {
  const env = getEnv();
  return {
    scraping: {
      instagram: {
        provider: env.SCRAPER_PROVIDER === "apify" ? "apify" : env.SCRAPER_PROVIDER === "local" ? "playwright" : "manual",
        apifyToken: env.APIFY_API_TOKEN || "",
      },
      tiktok: {
        provider: process.env.APIFY_API_TOKEN ? "apify_tiktok" : "ytdlp",
        apifyToken: env.APIFY_API_TOKEN || "",
      },
      youtube: {
        provider: process.env.YOUTUBE_API_KEY ? "youtube_api" : "ytdlp",
        apiKey: process.env.YOUTUBE_API_KEY || "",
      },
    },
    ai: {
      analysis: {
        provider: env.AI_PROVIDER === "claude" ? "claude" : env.AI_PROVIDER === "ollama" ? "ollama" : "gemini",
        geminiKey: env.GEMINI_API_KEY || "",
        claudeKey: env.ANTHROPIC_API_KEY || "",
        model: "gemini-2.5-flash",
      },
      scriptGen: {
        provider: env.ANTHROPIC_API_KEY ? "claude" : "gemini",
        geminiKey: env.GEMINI_API_KEY || "",
        claudeKey: env.ANTHROPIC_API_KEY || "",
        model: env.ANTHROPIC_API_KEY ? "claude-sonnet-4-5" : "gemini-2.5-flash",
      },
      transcript: {
        provider: env.TRANSCRIPT_PROVIDER === "whisper-local" ? "whisper-local" : "gemini",
        geminiKey: env.GEMINI_API_KEY || "",
      },
    },
    tts: {
      provider: process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "edge_tts",
      voice: process.env.TTS_FREE_VOICE || "en-US-AriaNeural",
      elevenLabsKey: process.env.ELEVENLABS_API_KEY || "",
      elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "",
      openaiKey: process.env.OPENAI_API_KEY || "",
    },
    video: {
      provider: env.VIDEO_PROVIDER === "fal" ? "fal" : env.FAL_KEY ? "fal" : "none",
      falKey: env.FAL_KEY || "",
      didKey: process.env.DID_API_KEY || "",
      model: "kling3",
    },
    notifications: {
      telegram: {
        enabled: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        botToken: env.TELEGRAM_BOT_TOKEN || "",
        chatId: env.TELEGRAM_CHAT_ID || "",
        webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || "",
      },
      discord: {
        enabled: Boolean(process.env.DISCORD_WEBHOOK_URL),
        webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
      },
      email: {
        enabled: Boolean(process.env.RESEND_API_KEY),
        resendKey: process.env.RESEND_API_KEY || "",
        fromEmail: process.env.EMAIL_FROM || "",
        toEmail: process.env.EMAIL_TO || "",
      },
    },
    schedule: {
      instagram: { interval: "6h", maxVideos: 10, enabled: false },
      tiktok: { interval: "2h", maxVideos: 10, enabled: false },
      youtube: { interval: "2h", maxVideos: 10, enabled: false },
      viralThreshold: 2.0,
      minViews: 10000,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

let cachedSettings: ProviderSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000; // 5 seconds — settings change infrequently

/**
 * Get current provider settings — merged from DB (user-configured) and env (defaults).
 * Settings from DB take priority. Caches for 5 seconds to avoid repeated DB hits.
 */
export async function getProviderSettings(forceRefresh = false): Promise<ProviderSettings> {
  if (!forceRefresh && cachedSettings && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const defaults = getDefaultsFromEnv();
  const stored = await repo.settings.get<Partial<ProviderSettings>>(SETTINGS_KEY);

  // Sanitize stored.schedule scalar fields — older buggy clients may have written
  // empty objects ({}) where a number was expected (viralThreshold, minViews).
  const storedSchedule = (stored?.schedule || {}) as Record<string, unknown>;
  const safeSchedule = {
    ...defaults.schedule,
    ...storedSchedule,
    viralThreshold:
      typeof storedSchedule.viralThreshold === "number"
        ? storedSchedule.viralThreshold
        : defaults.schedule.viralThreshold,
    minViews:
      typeof storedSchedule.minViews === "number"
        ? storedSchedule.minViews
        : defaults.schedule.minViews,
  };

  // Deep merge stored over defaults so partial settings don't lose other fields
  const merged: ProviderSettings = {
    scraping: { ...defaults.scraping, ...(stored?.scraping || {}) },
    ai: { ...defaults.ai, ...(stored?.ai || {}) },
    tts: { ...defaults.tts, ...(stored?.tts || {}) },
    video: { ...defaults.video, ...(stored?.video || {}) },
    notifications: { ...defaults.notifications, ...(stored?.notifications || {}) },
    schedule: safeSchedule,
  };

  cachedSettings = merged;
  cacheTimestamp = Date.now();
  return merged;
}

/**
 * Save provider settings to DB. Invalidates cache so next read returns fresh data.
 */
export async function saveProviderSettings(settings: Partial<ProviderSettings>): Promise<void> {
  const current = await getProviderSettings(true);
  const merged: ProviderSettings = {
    scraping: { ...current.scraping, ...(settings.scraping || {}) },
    ai: { ...current.ai, ...(settings.ai || {}) },
    tts: { ...current.tts, ...(settings.tts || {}) },
    video: { ...current.video, ...(settings.video || {}) },
    notifications: { ...current.notifications, ...(settings.notifications || {}) },
    schedule: { ...current.schedule, ...(settings.schedule || {}) },
  };
  await repo.settings.set(SETTINGS_KEY, merged);
  cachedSettings = merged;
  cacheTimestamp = Date.now();
}

/**
 * Returns settings with API keys masked (only first 4 chars visible).
 * Use for sending to client — never expose full keys.
 */
export async function getProviderSettingsMasked(): Promise<ProviderSettings> {
  const settings = await getProviderSettings();
  return JSON.parse(JSON.stringify(settings, (key, value) => {
    if (typeof value === "string" && value.length > 8 && /(key|token|secret|webhook)/i.test(key)) {
      return value.slice(0, 4) + "•".repeat(Math.max(value.length - 8, 4)) + value.slice(-4);
    }
    return value;
  }));
}

// ─── Provider resolvers ───────────────────────────────────────────────────────

/**
 * Resolves the effective scraper provider name for a given platform.
 * Used by the pipeline to pick the right provider implementation.
 */
export async function getEffectiveScraperProvider(platform: "instagram" | "tiktok" | "youtube_shorts"): Promise<string> {
  const settings = await getProviderSettings();
  if (platform === "instagram") return settings.scraping.instagram.provider;
  if (platform === "tiktok") return settings.scraping.tiktok.provider;
  if (platform === "youtube_shorts") return settings.scraping.youtube.provider;
  return "manual";
}

/**
 * Get API key for a provider (resolves DB → env fallback).
 */
export async function getApiKey(provider: string): Promise<string> {
  const settings = await getProviderSettings();
  switch (provider) {
    case "apify":
    case "apify_tiktok":
      return settings.scraping.instagram.apifyToken || settings.scraping.tiktok.apifyToken || "";
    case "youtube_api":
      return settings.scraping.youtube.apiKey || "";
    case "gemini":
      return settings.ai.analysis.geminiKey || settings.ai.transcript.geminiKey || "";
    case "claude":
      return settings.ai.analysis.claudeKey || settings.ai.scriptGen.claudeKey || "";
    case "elevenlabs":
      return settings.tts.elevenLabsKey || "";
    case "fal":
      return settings.video.falKey || "";
    case "did":
      return settings.video.didKey || "";
    default:
      return "";
  }
}

/**
 * Apply settings to process.env so legacy code paths (that read process.env directly)
 * still work. Called on app startup and after every settings save.
 */
export async function applySettingsToEnv(): Promise<void> {
  const settings = await getProviderSettings(true);
  // Only set env vars that are NOT already set, OR override if user changed them in DB
  const envMap: Record<string, string | undefined> = {
    APIFY_API_TOKEN: settings.scraping.instagram.apifyToken || settings.scraping.tiktok.apifyToken,
    GEMINI_API_KEY: settings.ai.analysis.geminiKey || settings.ai.transcript.geminiKey,
    ANTHROPIC_API_KEY: settings.ai.analysis.claudeKey || settings.ai.scriptGen.claudeKey,
    YOUTUBE_API_KEY: settings.scraping.youtube.apiKey,
    FAL_KEY: settings.video.falKey,
    DID_API_KEY: settings.video.didKey,
    ELEVENLABS_API_KEY: settings.tts.elevenLabsKey,
    ELEVENLABS_VOICE_ID: settings.tts.elevenLabsVoiceId,
    OPENAI_API_KEY: settings.tts.openaiKey,
    TTS_FREE_VOICE: settings.tts.voice,
    TELEGRAM_BOT_TOKEN: settings.notifications.telegram.botToken,
    TELEGRAM_CHAT_ID: settings.notifications.telegram.chatId,
    TELEGRAM_WEBHOOK_SECRET: settings.notifications.telegram.webhookSecret,
    DISCORD_WEBHOOK_URL: settings.notifications.discord.webhookUrl,
    RESEND_API_KEY: settings.notifications.email.resendKey,
    EMAIL_FROM: settings.notifications.email.fromEmail,
    EMAIL_TO: settings.notifications.email.toEmail,
  };
  for (const [key, value] of Object.entries(envMap)) {
    if (value && value.trim()) process.env[key] = value;
  }
}

/**
 * Test connection to a specific provider.
 * Returns { ok: boolean, message: string } describing the test result.
 */
export async function testProviderConnection(
  provider: string,
  config: { apiKey?: string; webhookUrl?: string; chatId?: string; botToken?: string }
): Promise<{ ok: boolean; message: string }> {
  try {
    switch (provider) {
      case "apify":
      case "apify_tiktok": {
        if (!config.apiKey) return { ok: false, message: "Apify token is required" };
        const res = await fetch(`https://api.apify.com/v2/users/me?token=${config.apiKey}`, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return { ok: false, message: `Apify HTTP ${res.status}` };
        const data = await res.json() as { data?: { username?: string; usageCycle?: { startAt?: string } } };
        return { ok: true, message: `Connected as ${data.data?.username || "user"}` };
      }
      case "gemini": {
        if (!config.apiKey) return { ok: false, message: "Gemini API key is required" };
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: 'Reply with: "ok"' }] }],
              generationConfig: { maxOutputTokens: 16 },
            }),
            signal: AbortSignal.timeout(15_000),
          }
        );
        if (!res.ok) return { ok: false, message: `Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
        return { ok: true, message: "Gemini API key is valid" };
      }
      case "claude": {
        if (!config.apiKey) return { ok: false, message: "Anthropic API key is required" };
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 16,
            messages: [{ role: "user", content: "Reply: ok" }],
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return { ok: false, message: `Claude HTTP ${res.status}` };
        return { ok: true, message: "Claude API key is valid" };
      }
      case "youtube_api": {
        if (!config.apiKey) return { ok: false, message: "YouTube API key is required" };
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${config.apiKey}`,
          { signal: AbortSignal.timeout(15_000) }
        );
        if (!res.ok) return { ok: false, message: `YouTube HTTP ${res.status}` };
        return { ok: true, message: "YouTube Data API key is valid" };
      }
      case "fal": {
        if (!config.apiKey) return { ok: false, message: "fal.ai key is required" };
        // fal.ai doesn't have a simple ping endpoint — just validate key format
        if (config.apiKey.length < 20) return { ok: false, message: "fal.ai key looks invalid (too short)" };
        return { ok: true, message: "fal.ai key format looks valid (full check on first generation)" };
      }
      case "elevenlabs": {
        if (!config.apiKey) return { ok: false, message: "ElevenLabs key is required" };
        const res = await fetch("https://api.elevenlabs.io/v1/user", {
          headers: { "xi-api-key": config.apiKey },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return { ok: false, message: `ElevenLabs HTTP ${res.status}` };
        return { ok: true, message: "ElevenLabs key is valid" };
      }
      case "telegram": {
        if (!config.botToken) return { ok: false, message: "Bot token is required" };
        const res = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return { ok: false, message: `Telegram HTTP ${res.status}` };
        const data = await res.json() as { result?: { username?: string } };
        return { ok: true, message: `Bot @${data.result?.username || "unknown"} is reachable` };
      }
      case "discord": {
        if (!config.webhookUrl) return { ok: false, message: "Discord webhook URL is required" };
        const res = await fetch(config.webhookUrl, { method: "GET", signal: AbortSignal.timeout(15_000) });
        if (!res.ok && res.status !== 200) return { ok: false, message: `Discord HTTP ${res.status}` };
        return { ok: true, message: "Discord webhook URL is reachable" };
      }
      case "edge_tts": {
        return { ok: true, message: "Edge TTS is free and always available" };
      }
      case "ytdlp": {
        const { execFile } = await import("child_process");
        const { promisify } = await import("util");
        const exec = promisify(execFile);
        try {
          const ytdlpCmd = process.env.YTDLP_COMMAND || "yt-dlp";
          const { stdout } = await exec(ytdlpCmd, ["--version"], { timeout: 10_000 });
          return { ok: true, message: `yt-dlp ${stdout.trim()} is installed` };
        } catch {
          return { ok: false, message: "yt-dlp not found — run `winget install yt-dlp`" };
        }
      }
      default:
        return { ok: false, message: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
