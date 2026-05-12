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
  type YtdlpMetadata,
} from "./ytdlp";

const TIKTOK_PROFILE_URL = (username: string) => `https://www.tiktok.com/@${username.replace(/^@/, "")}`;

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

export const tiktokProvider: InstagramScraperProvider = {
  name: "tiktok",
  async scrapeCreatorStats(username: string): Promise<CreatorStats> {
    if (!(await isYtdlpAvailable())) {
      throw new ProviderError("PROVIDER_AUTH", "yt-dlp is required for the TikTok provider.");
    }
    const reels = await listChannelVideos(TIKTOK_PROFILE_URL(username), 12, false);
    const recent = reels.slice(0, 30);
    const avgViews30d = recent.length
      ? Math.round(recent.reduce((sum, r) => sum + (r.viewCount ?? 0), 0) / recent.length)
      : 0;
    const firstThumb = recent.find((r) => typeof r.thumbnail === "string" && r.thumbnail);
    return {
      profilePicUrl: firstThumb?.thumbnail || "",
      followers: 0,
      reelsCount30d: recent.length,
      avgViews30d,
    };
  },
  async scrapeReels(input: ScrapeReelsInput): Promise<ScrapedReel[]> {
    if (!(await isYtdlpAvailable())) {
      throw new ProviderError("PROVIDER_AUTH", "yt-dlp is required for the TikTok provider.");
    }
    const items = await listChannelVideos(TIKTOK_PROFILE_URL(input.username), Math.max(input.maxVideos, 6), true);
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
