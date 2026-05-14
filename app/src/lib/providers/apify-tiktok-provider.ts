/**
 * Apify TikTok Scraper provider — far more reliable than yt-dlp for TikTok.
 *
 * Actor: clockworks/tiktok-scraper
 * Cost: ~$0.02 per run (50 videos)
 * Docs: https://apify.com/clockworks/tiktok-scraper
 *
 * Replaces yt-dlp for TikTok scraping when APIFY_API_TOKEN is configured.
 */

import type { CreatorStats, ScrapedReel } from "@/lib/types";
import type { DownloadVideoInput, InstagramScraperProvider, ScrapeReelsInput, SessionStatus } from "./instagram";
import { downloadByUrl } from "./instagram";
import { ProviderError } from "./errors";

interface ApifyTiktokVideo {
  id?: string;
  webVideoUrl?: string;
  text?: string;
  videoMeta?: {
    coverUrl?: string;
    downloadAddr?: string;
    duration?: number;
    width?: number;
    height?: number;
  };
  authorMeta?: {
    name?: string;
    nickName?: string;
    fans?: number;
    avatar?: string;
    profileUrl?: string;
  };
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  createTime?: number;
  createTimeISO?: string;
}

function getToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new ProviderError("PROVIDER_AUTH", "APIFY_API_TOKEN not configured");
  return token;
}

async function callApifyTiktok(input: Record<string, unknown>): Promise<ApifyTiktokVideo[]> {
  const token = getToken();
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${token}&memory=512&timeout=180`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(240_000),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Apify TikTok HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      return (await response.json()) as ApifyTiktokVideo[];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      if (/fetch failed|timeout|econnreset|abort/i.test(msg) && attempt < 2) {
        console.warn(`[apify-tiktok] Retry ${attempt + 1}: ${lastError.message}`);
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error("Apify TikTok scrape failed");
}

function videoToReel(video: ApifyTiktokVideo, fallbackUsername: string): ScrapedReel {
  const username = video.authorMeta?.name || fallbackUsername;
  const videoId = video.id || "";
  // Build canonical URL — only use constructed URL if we have a valid video ID
  const sourcePostUrl = video.webVideoUrl ||
    (videoId ? `https://www.tiktok.com/@${username}/video/${videoId}` : "");
  return {
    platform: "tiktok",
    sourcePostUrl,
    shortcode: videoId,
    creatorUsername: username.replace(/^@/, ""),
    caption: video.text || "",
    thumbnailUrl: video.videoMeta?.coverUrl || "",
    videoFileUrl: video.videoMeta?.downloadAddr || null,
    postedAt: video.createTimeISO || (video.createTime ? new Date(video.createTime * 1000).toISOString() : ""),
    views: video.playCount || 0,
    likes: video.diggCount || 0,
    comments: video.commentCount || 0,
    durationSeconds: video.videoMeta?.duration,
    rawProviderPayload: video as unknown as Record<string, unknown>,
  };
}

export const apifyTiktokProvider: InstagramScraperProvider = {
  name: "tiktok",

  async scrapeCreatorStats(username: string): Promise<CreatorStats & { detectedAlias?: string }> {
    try {
      const items = await callApifyTiktok({
        profiles: [`https://www.tiktok.com/@${username.replace(/^@/, "")}`],
        resultsPerPage: 30,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
      });

      if (items.length === 0) {
        return { profilePicUrl: "", followers: 0, reelsCount30d: 0, avgViews30d: 0 };
      }

      const author = items[0]?.authorMeta;
      const followers = author?.fans || 0;
      const profilePicUrl = author?.avatar || "";
      const resolvedUsername = author?.name || username;

      const validItems = items.filter((i) => (i.playCount || 0) > 0);
      const avgViews30d = validItems.length
        ? Math.round(validItems.reduce((sum, i) => sum + (i.playCount || 0), 0) / validItems.length)
        : 0;

      const normalizedInput = username.replace(/^@/, "").toLowerCase();
      const detectedAlias =
        resolvedUsername && resolvedUsername.toLowerCase() !== normalizedInput
          ? resolvedUsername
          : undefined;

      return {
        profilePicUrl,
        followers,
        reelsCount30d: items.length,
        avgViews30d,
        detectedAlias,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[apify-tiktok] scrapeCreatorStats failed for @${username}: ${msg}`);
      return { profilePicUrl: "", followers: 0, reelsCount30d: 0, avgViews30d: 0 };
    }
  },

  async scrapeReels(input: ScrapeReelsInput): Promise<ScrapedReel[]> {
    const items = await callApifyTiktok({
      profiles: [`https://www.tiktok.com/@${input.username.replace(/^@/, "")}`],
      resultsPerPage: input.maxVideos,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
    });

    const reels = items.map((v) => videoToReel(v, input.username));

    // Filter by date range
    if (input.nDays && input.nDays > 0) {
      const cutoff = Date.now() - input.nDays * 86_400_000;
      return reels.filter((r) => {
        if (!r.postedAt) return true;
        const time = new Date(r.postedAt).getTime();
        return Number.isNaN(time) ? true : time >= cutoff;
      });
    }
    return reels;
  },

  async refreshVideoUrl(postUrl: string): Promise<string | null> {
    try {
      const items = await callApifyTiktok({
        postURLs: [postUrl],
        resultsPerPage: 1,
        shouldDownloadVideos: false,
      });
      return items[0]?.videoMeta?.downloadAddr || null;
    } catch {
      return null;
    }
  },

  async downloadVideo(input: DownloadVideoInput): Promise<{ buffer: Buffer; contentType: string }> {
    const videoUrl =
      input.videoFileUrl ||
      (input.postUrl ? await this.refreshVideoUrl(input.postUrl) : null);
    if (!videoUrl) {
      throw new Error("Could not resolve TikTok video URL");
    }
    return downloadByUrl(videoUrl);
  },

  async validateSession(): Promise<{ status: SessionStatus; message: string }> {
    return process.env.APIFY_API_TOKEN
      ? { status: "ok", message: "Apify TikTok scraper is configured" }
      : { status: "login_required", message: "APIFY_API_TOKEN is missing" };
  },
};
