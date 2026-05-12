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
const TIKTOK_RE = /^(?:https?:\/\/)?(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/(?:@[^/]+\/video\/(\d+)|v\/(\d+)|t\/([^/?#]+)|([A-Za-z0-9]{6,}))/i;
const YOUTUBE_SHORTS_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/shorts\/|youtu\.be\/)([^/?#&]+)/i;
const YOUTUBE_WATCH_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?v=([^&?#]+)/i;

export interface DetectedUrl {
  platform: SocialPlatform | "unknown";
  shortcode: string;
  /** Normalised URL stripped of tracking parameters (when possible). */
  normalisedUrl: string;
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
    const shortcode = tt[1] || tt[2] || tt[3] || tt[4] || "";
    return {
      platform: "tiktok",
      shortcode,
      normalisedUrl: trimmed,
    };
  }

  const ys = YOUTUBE_SHORTS_RE.exec(trimmed);
  if (ys) {
    return {
      platform: "youtube_shorts",
      shortcode: ys[1] || "",
      normalisedUrl: `https://www.youtube.com/shorts/${ys[1]}`,
    };
  }

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
