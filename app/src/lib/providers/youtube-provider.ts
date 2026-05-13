/**
 * YouTube Shorts scraper provider.
 *
 * Strategy:
 *   - Listing & metadata: yt-dlp pointed at a channel's Shorts tab
 *     (https://www.youtube.com/@channel/shorts).
 *   - Single-video metadata + download: yt-dlp.
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

function channelShortsUrl(usernameOrChannel: string): string {
  const handle = usernameOrChannel.trim();
  if (/^https?:\/\//i.test(handle)) return handle.replace(/\/+$/, "") + "/shorts";
  const cleaned = handle.replace(/^@/, "");
  return `https://www.youtube.com/@${cleaned}/shorts`;
}

function metadataToReel(meta: YtdlpMetadata, fallbackUsername: string): ScrapedReel {
  const sourcePostUrl = meta.id ? `https://www.youtube.com/shorts/${meta.id}` : meta.url;
  return {
    platform: "youtube_shorts",
    sourcePostUrl,
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

export const youtubeProvider: InstagramScraperProvider = {
  name: "youtube",
  async scrapeCreatorStats(username: string): Promise<CreatorStats & { detectedAlias?: string }> {
    if (!(await isYtdlpAvailable())) {
      throw new ProviderError("PROVIDER_AUTH", "yt-dlp is required for the YouTube Shorts provider.");
    }
    let listing;
    try {
      listing = await listChannelVideosWithProfile(channelShortsUrl(username), 12, false);
    } catch (error) {
      // Graceful fallback: if shorts tab fails, try /videos tab
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[youtube-provider] Shorts listing failed for "${username}", trying /videos: ${msg}`);
      try {
        const videosUrl = channelShortsUrl(username).replace(/\/shorts$/, "/videos");
        listing = await listChannelVideosWithProfile(videosUrl, 12, false);
      } catch {
        // Both failed — return empty stats instead of crashing
        console.warn(`[youtube-provider] Both shorts and videos listing failed for "${username}", returning partial stats.`);
        return {
          profilePicUrl: "",
          followers: 0,
          reelsCount30d: 0,
          avgViews30d: 0,
        };
      }
    }
    // Only count items with valid view counts for accurate average
    const validItems = listing.items.filter(r => (r.viewCount ?? 0) > 0);
    const avgViews30d = validItems.length
      ? Math.round(validItems.reduce((sum, r) => sum + (r.viewCount ?? 0), 0) / validItems.length)
      : 0;
    const firstThumb = listing.items.find((r) => typeof r.thumbnail === "string" && r.thumbnail);
    // Auto-detect alias
    const resolvedUploader = listing.uploader?.replace(/^@/, "");
    const normalizedInput = username.replace(/^@/, "").toLowerCase();
    const detectedAlias = resolvedUploader && resolvedUploader.toLowerCase() !== normalizedInput
      ? resolvedUploader
      : undefined;
    return {
      profilePicUrl: listing.profilePicUrl || firstThumb?.thumbnail || "",
      followers: listing.followerCount,
      reelsCount30d: listing.items.length,
      avgViews30d,
      detectedAlias,
    };
  },
  async scrapeReels(input: ScrapeReelsInput): Promise<ScrapedReel[]> {
    if (!(await isYtdlpAvailable())) {
      throw new ProviderError("PROVIDER_AUTH", "yt-dlp is required for the YouTube Shorts provider.");
    }
    const items = await listChannelVideos(channelShortsUrl(input.username), Math.max(input.maxVideos, 6), true);
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
    if (!url) throw new Error("YouTube download requires a postUrl or videoFileUrl.");
    return downloadVideoToBuffer(url);
  },
  async validateSession(): Promise<{ status: SessionStatus; message: string }> {
    const ok = await isYtdlpAvailable();
    return ok
      ? { status: "ok", message: "yt-dlp is available — YouTube Shorts provider ready." }
      : { status: "login_required", message: "yt-dlp not found. Install it: `winget install yt-dlp` (Windows) or `brew install yt-dlp` (macOS)." };
  },
};
