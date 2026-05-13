/**
 * TikTok scraper provider.
 *
 * Strategy:
 *   - Listing & metadata: yt-dlp pointed at a profile URL (https://www.tiktok.com/@username).
 *   - Single-video download: yt-dlp downloads the watermarked MP4 to a buffer.
 *
 * yt-dlp must be installed on the host (free, open source). See
 * `app/src/lib/providers/ytdlp.ts` for installation notes.
 */

import type { CreatorStats, ScrapedReel } from "@/lib/types";
import type { DownloadVideoInput, InstagramScraperProvider, ScrapeReelsInput, SessionStatus } from "./instagram";
import { ProviderError } from "./errors";
import {
  downloadVideoToBuffer,
  getVideoMetadata,
  isYtdlpAvailable,
  listChannelVideos,
  listChannelVideosWithProfile,
  type YtdlpMetadata,
} from "./ytdlp";

function tiktokProfileUrl(usernameOrUrl: string) {
  const value = usernameOrUrl.trim();
  if (/^https?:\/\//i.test(value) || value.startsWith("tiktokuser:")) return value;
  return `https://www.tiktok.com/@${value.replace(/^@/, "")}`;
}

function metadataToReel(meta: YtdlpMetadata, fallbackUsername: string): ScrapedReel {
  return {
    platform: "tiktok",
    sourcePostUrl: meta.url,
    shortcode: meta.id,
    creatorUsername: (meta.uploader || fallbackUsername).replace(/^@/, ""),
    caption: meta.title || meta.description || "",
    thumbnailUrl: meta.thumbnail || "",
    videoFileUrl: meta.videoUrl || null,
    postedAt: meta.uploadDate || "",
    views: meta.viewCount ?? 0,
    likes: meta.likeCount ?? 0,
    comments: meta.commentCount ?? 0,
    durationSeconds: meta.durationSeconds,
    rawProviderPayload: meta.raw,
  };
}

function filterByDays(reels: ScrapedReel[], nDays: number): ScrapedReel[] {
  if (!nDays || nDays <= 0) return reels;
  const cutoff = Date.now() - nDays * 86_400_000;
  return reels.filter((r) => {
    if (!r.postedAt) return true;
    const time = new Date(r.postedAt).getTime();
    return Number.isNaN(time) ? true : time >= cutoff;
  });
}

function tiktokError(error: unknown, username: string) {
  const message = error instanceof Error ? error.message : String(error);
  if (/secondary user ID|channel_id|tiktokuser/i.test(message)) {
    return new ProviderError(
      "VALIDATION_ERROR",
      `yt-dlp cannot resolve TikTok profile "${username}" by handle. Add/import a real TikTok video URL first, or edit this creator username to yt-dlp's tiktokuser:CHANNEL_ID format if you know the channel id. Original error: ${message}`
    );
  }
  return error;
}

export const tiktokProvider: InstagramScraperProvider = {
  name: "tiktok",
  async scrapeCreatorStats(username: string): Promise<CreatorStats & { detectedAlias?: string }> {
    if (!(await isYtdlpAvailable())) {
      throw new ProviderError("PROVIDER_AUTH", "yt-dlp is required for the TikTok provider.");
    }
    let listing;
    try {
      // Use hydrate: false to avoid downloading metadata per video (much faster, avoids timeouts)
      listing = await listChannelVideosWithProfile(tiktokProfileUrl(username), 12, false);
    } catch (error) {
      const wrapped = tiktokError(error, username);
      // Graceful fallback: return empty stats instead of hard error for handle resolution failures
      if (wrapped instanceof ProviderError && wrapped.code === "VALIDATION_ERROR") {
        console.warn(`[tiktok-provider] Handle resolution failed for "${username}", returning partial stats. Error: ${wrapped.message}`);
        return {
          profilePicUrl: "",
          followers: 0,
          reelsCount30d: 0,
          avgViews30d: 0,
        };
      }
      throw wrapped;
    }
    const recent = listing.items.slice(0, 30);
    // Only count items with valid view counts for average calculation
    const validViews = recent.filter(r => (r.viewCount ?? 0) > 0);
    const avgViews30d = validViews.length
      ? Math.round(validViews.reduce((sum, r) => sum + (r.viewCount ?? 0), 0) / validViews.length)
      : 0;
    const firstThumb = recent.find((r) => typeof r.thumbnail === "string" && r.thumbnail);
    // Auto-detect alias: if yt-dlp resolved a different uploader name, return it
    const resolvedUploader = listing.uploader?.replace(/^@/, "");
    const normalizedInput = username.replace(/^@/, "").toLowerCase();
    const detectedAlias = resolvedUploader && resolvedUploader.toLowerCase() !== normalizedInput
      ? resolvedUploader
      : undefined;
    return {
      profilePicUrl: listing.profilePicUrl || firstThumb?.thumbnail || "",
      followers: listing.followerCount,
      reelsCount30d: recent.length,
      avgViews30d,
      detectedAlias,
    };
  },
  async scrapeReels(input: ScrapeReelsInput): Promise<ScrapedReel[]> {
    if (!(await isYtdlpAvailable())) {
      throw new ProviderError("PROVIDER_AUTH", "yt-dlp is required for the TikTok provider.");
    }
    let items;
    try {
      items = await listChannelVideos(tiktokProfileUrl(input.username), Math.max(input.maxVideos, 6), true);
    } catch (error) {
      throw tiktokError(error, input.username);
    }
    const reels = items.map((m) => metadataToReel(m, input.username));
    return filterByDays(reels, input.nDays).slice(0, input.maxVideos);
  },
  async refreshVideoUrl(postUrl: string): Promise<string | null> {
    try {
      const meta = await getVideoMetadata(postUrl);
      return meta.videoUrl ?? null;
    } catch {
      return null;
    }
  },
  async downloadVideo(input: DownloadVideoInput) {
    const url = input.postUrl || input.videoFileUrl;
    if (!url) throw new Error("TikTok download requires a postUrl or videoFileUrl.");
    return downloadVideoToBuffer(url);
  },
  async validateSession(): Promise<{ status: SessionStatus; message: string }> {
    const ok = await isYtdlpAvailable();
    return ok
      ? { status: "ok", message: "yt-dlp is available — TikTok provider ready." }
      : { status: "login_required", message: "yt-dlp not found. Install it: `winget install yt-dlp` (Windows) or `brew install yt-dlp` (macOS)." };
  },
};
