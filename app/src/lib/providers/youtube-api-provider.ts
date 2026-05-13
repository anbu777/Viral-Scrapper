/**
 * YouTube Data API v3 provider — official, free, reliable.
 *
 * Quota: 10,000 units/day free
 *   - Search: 100 units per call
 *   - Channels: 1 unit per call
 *   - Videos: 1 unit per call
 *
 * Estimated cost per creator scrape: ~5 units (1 channel + 1 search + 1 videos batch)
 * → can scrape ~2,000 creators/day for free
 *
 * Setup: https://console.cloud.google.com/apis/credentials
 */

import type { CreatorStats, ScrapedReel } from "@/lib/types";
import type { DownloadVideoInput, InstagramScraperProvider, ScrapeReelsInput, SessionStatus } from "./instagram";
import { ProviderError } from "./errors";
import { downloadVideoToBuffer } from "./ytdlp";

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YtChannelResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } };
      customUrl?: string;
    };
    statistics?: {
      subscriberCount?: string;
      viewCount?: string;
      videoCount?: string;
    };
    contentDetails?: {
      relatedPlaylists?: { uploads?: string };
    };
  }>;
}

interface YtSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string }; maxres?: { url?: string } };
      channelTitle?: string;
    };
  }>;
  nextPageToken?: string;
}

interface YtVideosResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: { medium?: { url?: string }; high?: { url?: string }; maxres?: { url?: string } };
      channelTitle?: string;
      channelId?: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
    contentDetails?: {
      duration?: string;
    };
  }>;
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new ProviderError("PROVIDER_AUTH", "YOUTUBE_API_KEY not configured");
  return key;
}

/** Parse ISO 8601 duration (PT1M30S) → seconds */
function parseISODuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

/** Resolve channel ID from username/handle */
async function resolveChannelId(handle: string): Promise<{ channelId: string; uploadsPlaylistId: string; subscribers: number; thumbnail: string; title: string } | null> {
  const key = getApiKey();
  const cleanHandle = handle.replace(/^@/, "");

  // Try forHandle first (newer YouTube handles like @MrBeast)
  let url = `${YT_API_BASE}/channels?part=snippet,statistics,contentDetails&forHandle=@${cleanHandle}&key=${key}`;
  let response = await fetch(url, { signal: AbortSignal.timeout(15_000) });

  if (response.ok) {
    const data = (await response.json()) as YtChannelResponse;
    const channel = data.items?.[0];
    if (channel?.id) {
      return {
        channelId: channel.id,
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || "",
        subscribers: Number(channel.statistics?.subscriberCount || 0),
        thumbnail: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.medium?.url || "",
        title: channel.snippet?.title || cleanHandle,
      };
    }
  }

  // Fallback: forUsername (legacy custom URLs)
  url = `${YT_API_BASE}/channels?part=snippet,statistics,contentDetails&forUsername=${cleanHandle}&key=${key}`;
  response = await fetch(url, { signal: AbortSignal.timeout(15_000) });

  if (response.ok) {
    const data = (await response.json()) as YtChannelResponse;
    const channel = data.items?.[0];
    if (channel?.id) {
      return {
        channelId: channel.id,
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || "",
        subscribers: Number(channel.statistics?.subscriberCount || 0),
        thumbnail: channel.snippet?.thumbnails?.high?.url || "",
        title: channel.snippet?.title || cleanHandle,
      };
    }
  }

  return null;
}

/** Get recent videos from a channel — filter to Shorts (<=60s) */
async function getChannelShorts(channelId: string, maxResults = 50): Promise<YtVideosResponse["items"]> {
  const key = getApiKey();

  // Step 1: Search for recent videos from channel
  const searchUrl = `${YT_API_BASE}/search?part=id&channelId=${channelId}&type=video&order=date&maxResults=${Math.min(maxResults, 50)}&videoDuration=short&key=${key}`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(15_000) });
  if (!searchRes.ok) {
    const text = await searchRes.text();
    throw new Error(`YouTube search HTTP ${searchRes.status}: ${text.slice(0, 200)}`);
  }
  const searchData = (await searchRes.json()) as YtSearchResponse;
  const videoIds = (searchData.items || [])
    .map((item) => item.id?.videoId)
    .filter(Boolean) as string[];

  if (videoIds.length === 0) return [];

  // Step 2: Get full video details (statistics + duration)
  const videosUrl = `${YT_API_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${key}`;
  const videosRes = await fetch(videosUrl, { signal: AbortSignal.timeout(15_000) });
  if (!videosRes.ok) {
    const text = await videosRes.text();
    throw new Error(`YouTube videos HTTP ${videosRes.status}: ${text.slice(0, 200)}`);
  }
  const videosData = (await videosRes.json()) as YtVideosResponse;

  // Filter to actual Shorts (<=60s)
  return (videosData.items || []).filter((v) => {
    const duration = parseISODuration(v.contentDetails?.duration || "PT0S");
    return duration > 0 && duration <= 60;
  });
}

function videoToReel(video: NonNullable<YtVideosResponse["items"]>[number], fallbackUsername: string): ScrapedReel {
  const username = video.snippet?.channelTitle || fallbackUsername;
  return {
    platform: "youtube_shorts",
    sourcePostUrl: video.id ? `https://www.youtube.com/shorts/${video.id}` : "",
    shortcode: video.id || "",
    creatorUsername: username.replace(/^@/, ""),
    caption: video.snippet?.title || video.snippet?.description || "",
    thumbnailUrl:
      video.snippet?.thumbnails?.maxres?.url ||
      video.snippet?.thumbnails?.high?.url ||
      video.snippet?.thumbnails?.medium?.url ||
      "",
    videoFileUrl: null, // YouTube doesn't provide direct video URL — use yt-dlp to download
    postedAt: video.snippet?.publishedAt || "",
    views: Number(video.statistics?.viewCount || 0),
    likes: Number(video.statistics?.likeCount || 0),
    comments: Number(video.statistics?.commentCount || 0),
    durationSeconds: parseISODuration(video.contentDetails?.duration || "PT0S"),
    rawProviderPayload: video as unknown as Record<string, unknown>,
  };
}

export const youtubeApiProvider: InstagramScraperProvider = {
  name: "youtube",

  async scrapeCreatorStats(username: string): Promise<CreatorStats & { detectedAlias?: string }> {
    try {
      const channel = await resolveChannelId(username);
      if (!channel) {
        console.warn(`[youtube-api] Could not resolve channel for "${username}"`);
        return { profilePicUrl: "", followers: 0, reelsCount30d: 0, avgViews30d: 0 };
      }

      const shorts = await getChannelShorts(channel.channelId, 30);
      const validShorts = (shorts || []).filter((v) => Number(v.statistics?.viewCount || 0) > 0);
      const avgViews30d = validShorts.length
        ? Math.round(
            validShorts.reduce((sum, v) => sum + Number(v.statistics?.viewCount || 0), 0) / validShorts.length
          )
        : 0;

      const normalizedInput = username.replace(/^@/, "").toLowerCase();
      const detectedAlias =
        channel.title && channel.title.toLowerCase() !== normalizedInput ? channel.title : undefined;

      return {
        profilePicUrl: channel.thumbnail,
        followers: channel.subscribers,
        reelsCount30d: validShorts.length,
        avgViews30d,
        detectedAlias,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[youtube-api] scrapeCreatorStats failed for @${username}: ${msg}`);
      return { profilePicUrl: "", followers: 0, reelsCount30d: 0, avgViews30d: 0 };
    }
  },

  async scrapeReels(input: ScrapeReelsInput): Promise<ScrapedReel[]> {
    const channel = await resolveChannelId(input.username);
    if (!channel) {
      throw new Error(`YouTube channel not found for "${input.username}"`);
    }
    const shorts = await getChannelShorts(channel.channelId, input.maxVideos);
    const reels = (shorts || []).map((v) => videoToReel(v, input.username));

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

  async refreshVideoUrl(): Promise<string | null> {
    // YouTube doesn't expose direct video URLs; yt-dlp is needed for download
    return null;
  },

  async downloadVideo(input: DownloadVideoInput): Promise<{ buffer: Buffer; contentType: string }> {
    const url = input.postUrl;
    if (!url) {
      throw new Error("YouTube download requires postUrl");
    }
    return downloadVideoToBuffer(url);
  },

  async validateSession(): Promise<{ status: SessionStatus; message: string }> {
    return process.env.YOUTUBE_API_KEY
      ? { status: "ok", message: "YouTube Data API v3 is configured" }
      : { status: "login_required", message: "YOUTUBE_API_KEY is missing — get free at console.cloud.google.com" };
  },
};
