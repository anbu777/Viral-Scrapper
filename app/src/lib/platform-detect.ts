/**
 * Detects the source social platform from a video URL.
 *
 * Used by:
 *  - Import API to route a URL to the correct provider.
 *  - Import page to auto-tag pasted URLs for the user.
 *  - Pipeline to pick the right scraper provider per video.
 */

import type { SocialPlatform } from "@/lib/types";

const INSTAGRAM_RE = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv|reels)\/([^/?#]+)/i;
const TIKTOK_RE = /^(?:https?:\/\/)?(?:(?:www|vm|vt|m)\.)?tiktok\.com\/(?:@([^/]+)\/video\/(\d+)|v\/(\d+)|t\/([^/?#]+)|([A-Za-z0-9_-]{6,}))/i;
const YOUTUBE_SHORTS_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/shorts\/|youtu\.be\/)([^/?#&]+)/i;
const YOUTUBE_WATCH_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?v=([^&#?]+)/i;

/** Extract @username from TikTok profile URL or video URL */
const TIKTOK_USERNAME_RE = /tiktok\.com\/@([^/?#]+)/i;
/** Extract @handle from YouTube channel URL */
const YOUTUBE_USERNAME_RE = /youtube\.com\/@([^/?#]+)/i;

export interface DetectedUrl {
  platform: SocialPlatform | "unknown";
  shortcode: string;
  /** Normalised URL stripped of tracking parameters (when possible). */
  normalisedUrl: string;
  /** Username extracted from the URL, if detectable. */
  detectedUsername?: string;
}

export function detectPlatform(url: string): DetectedUrl {
  const trimmed = url.trim();

  const ig = INSTAGRAM_RE.exec(trimmed);
  if (ig) {
    return {
      platform: "instagram",
      shortcode: ig[1] || "",
      normalisedUrl: `https://www.instagram.com/reel/${ig[1]}/`,
    };
  }

  const tt = TIKTOK_RE.exec(trimmed);
  if (tt) {
    const shortcode = tt[2] || tt[3] || tt[4] || tt[5] || "";
    const usernameMatch = TIKTOK_USERNAME_RE.exec(trimmed);
    const detectedUsername = usernameMatch?.[1]?.replace(/^@/, "") || (tt[1] || "").replace(/^@/, "") || undefined;
    return {
      platform: "tiktok",
      shortcode,
      normalisedUrl: trimmed,
      detectedUsername,
    };
  }

  const ys = YOUTUBE_SHORTS_RE.exec(trimmed);
  if (ys) {
    const usernameMatch = YOUTUBE_USERNAME_RE.exec(trimmed);
    return {
      platform: "youtube_shorts",
      shortcode: ys[1] || "",
      normalisedUrl: `https://www.youtube.com/shorts/${ys[1]}`,
      detectedUsername: usernameMatch?.[1]?.replace(/^@/, ""),
    };
  }

  // YouTube watch URLs — could be shorts viewed in regular player.
  // We classify as youtube_shorts but the caller should verify later.
  const yw = YOUTUBE_WATCH_RE.exec(trimmed);
  if (yw) {
    return {
      platform: "youtube_shorts",
      shortcode: yw[1] || "",
      normalisedUrl: `https://www.youtube.com/shorts/${yw[1]}`,
    };
  }

  return { platform: "unknown", shortcode: "", normalisedUrl: trimmed };
}

export function platformDisplayName(platform: SocialPlatform | "unknown"): string {
  switch (platform) {
    case "instagram": return "Instagram";
    case "tiktok": return "TikTok";
    case "youtube_shorts": return "YouTube Shorts";
    default: return "Unknown";
  }
}
