import type { CreatorStats, ScrapedReel, ScraperProviderName } from "@/lib/types";

export type SessionStatus =
  | "ok"
  | "login_required"
  | "challenge_required"
  | "rate_limited"
  | "private"
  | "deleted"
  | "unknown_error";

export interface ScrapeReelsInput {
  username: string;
  maxVideos: number;
  nDays: number;
}

export interface DownloadVideoInput {
  postUrl?: string;
  videoFileUrl?: string | null;
}

export interface InstagramScraperProvider {
  name: ScraperProviderName;
  scrapeCreatorStats(username: string): Promise<CreatorStats>;
  scrapeReels(input: ScrapeReelsInput): Promise<ScrapedReel[]>;
  refreshVideoUrl(postUrl: string): Promise<string | null>;
  downloadVideo(input: DownloadVideoInput): Promise<{ buffer: Buffer; contentType: string }>;
  validateSession(): Promise<{ status: SessionStatus; message: string }>;
}

export function extractShortcode(url: string): string {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match?.[1] || "";
}

export async function downloadByUrl(videoFileUrl?: string | null) {
  if (!videoFileUrl) throw new Error("No video URL available");
  const response = await fetch(videoFileUrl);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "video/mp4",
  };
}
