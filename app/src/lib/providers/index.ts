import { getEnv } from "@/lib/env";
import type { ScraperProviderName, SocialPlatform } from "@/lib/types";
import type { InstagramScraperProvider } from "./instagram";
import { apifyProvider } from "./apify-provider";
import { localProvider } from "./local-provider";
import { manualProvider } from "./manual-provider";
import { metaProvider } from "./meta-provider";
import { tiktokProvider } from "./tiktok-provider";
import { youtubeProvider } from "./youtube-provider";
import { apifyTiktokProvider } from "./apify-tiktok-provider";
import { youtubeApiProvider } from "./youtube-api-provider";

const providers: Record<ScraperProviderName, InstagramScraperProvider> = {
  apify: apifyProvider,
  local: localProvider,
  manual: manualProvider,
  meta: metaProvider,
  tiktok: tiktokProvider,
  youtube: youtubeProvider,
};

export function getInstagramProvider(name: ScraperProviderName = getEnv().SCRAPER_PROVIDER) {
  return providers[name] ?? providers.local;
}

/**
 * Picks a provider that can actually collect profile stats. Prefers configured
 * paid providers (Apify, YouTube API) when API keys are available.
 */
export function getStatsProviderForPlatform(
  platform: SocialPlatform,
  fallback: ScraperProviderName = getEnv().SCRAPER_PROVIDER
): InstagramScraperProvider {
  if (platform === "tiktok") {
    if (process.env.APIFY_API_TOKEN) return apifyTiktokProvider;
    return providers.tiktok;
  }
  if (platform === "youtube_shorts") {
    if (process.env.YOUTUBE_API_KEY) return youtubeApiProvider;
    return providers.youtube;
  }
  if ((fallback === "manual" || fallback === "meta") && process.env.APIFY_API_TOKEN) {
    return providers.apify;
  }
  return getInstagramProvider(fallback);
}

/**
 * Picks the best scraper provider for a given content platform. Auto-routes to
 * configured paid providers (Apify, YouTube API) when keys are available.
 */
export function getProviderForPlatform(
  platform: SocialPlatform,
  fallback: ScraperProviderName = getEnv().SCRAPER_PROVIDER
): InstagramScraperProvider {
  if (platform === "tiktok") {
    if (process.env.APIFY_API_TOKEN) return apifyTiktokProvider;
    return providers.tiktok;
  }
  if (platform === "youtube_shorts") {
    if (process.env.YOUTUBE_API_KEY) return youtubeApiProvider;
    return providers.youtube;
  }
  return getInstagramProvider(fallback);
}

/** Maps a content platform to the canonical scraper provider name. */
export function platformToProviderName(
  platform: SocialPlatform,
  fallback: ScraperProviderName = getEnv().SCRAPER_PROVIDER
): ScraperProviderName {
  if (platform === "tiktok") return "tiktok";
  if (platform === "youtube_shorts") return "youtube";
  return fallback;
}

export async function logProviderCall<T>(
  provider: InstagramScraperProvider,
  operation: string,
  request: unknown,
  fn: () => Promise<T>
): Promise<T> {
  const { repo } = await import("@/db/repositories");
  const start = Date.now();
  try {
    const response = await fn();
    await repo.providerLogs.add({
      provider: provider.name,
      operation,
      status: "success",
      request,
      response,
      durationMs: Date.now() - start,
    });
    return response;
  } catch (error) {
    const { classifyProviderError } = await import("./errors");
    await repo.providerLogs.add({
      provider: provider.name,
      operation,
      status: "error",
      request,
      response: {},
      errorCode: classifyProviderError(error),
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
    });
    throw error;
  }
}
