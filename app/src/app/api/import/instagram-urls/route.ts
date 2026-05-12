/**
 * Multi-platform URL import endpoint.
 *
 * Despite the historical path (`instagram-urls`), this endpoint accepts URLs
 * from Instagram, TikTok and YouTube Shorts. Each URL is auto-detected and
 * stored with the correct `platform` field. For TikTok/YouTube, if yt-dlp is
 * available, the import is enriched with the real thumbnail, caption,
 * uploader, and view count so the dashboard works immediately without
 * waiting for the analysis pipeline.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import type { ScrapedReel, SocialPlatform } from "@/lib/types";
import { repo } from "@/db/repositories";
import { extractShortcode } from "@/lib/providers/instagram";
import { detectPlatform } from "@/lib/platform-detect";
import { getVideoMetadata, isYtdlpAvailable } from "@/lib/providers/ytdlp";

const ImportSchema = z.object({
  configName: z.string().default("Manual Import"),
  category: z.string().default("manual"),
  urls: z.array(z.object({
    url: z.string().url(),
    creator: z.string().default("manual"),
    category: z.string().optional(),
    caption: z.string().optional(),
    /** Optional platform override; auto-detected when omitted. */
    platform: z.enum(["instagram", "tiktok", "youtube_shorts"]).optional(),
  })).min(1),
});

async function buildReel(
  url: string,
  platform: SocialPlatform,
  creator: string,
  caption: string | undefined,
  shortcode: string,
  ytdlpAvailable: boolean
): Promise<ScrapedReel> {
  const base: ScrapedReel = {
    platform,
    sourcePostUrl: url,
    shortcode,
    creatorUsername: creator,
    caption: caption || "",
    thumbnailUrl: "",
    videoFileUrl: null,
    postedAt: "",
    views: 0,
    likes: 0,
    comments: 0,
    rawProviderPayload: { manualImport: true, platform },
  };

  if (platform === "instagram" || !ytdlpAvailable) return base;

  try {
    const meta = await getVideoMetadata(url);
    return {
      ...base,
      shortcode: meta.id || shortcode,
      creatorUsername: meta.uploader || creator,
      caption: caption || meta.title || meta.description || "",
      thumbnailUrl: meta.thumbnail || "",
      videoFileUrl: meta.videoUrl || null,
      postedAt: meta.uploadDate || "",
      views: meta.viewCount ?? 0,
      likes: meta.likeCount ?? 0,
      comments: meta.commentCount ?? 0,
      durationSeconds: meta.durationSeconds,
      rawProviderPayload: { manualImport: true, platform, ytdlp: meta.raw },
    };
  } catch {
    return base;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ytdlpAvailable = await isYtdlpAvailable();
  const skipped: Array<{ url: string; reason: string }> = [];

  const imported = await Promise.all(parsed.data.urls.map(async (item) => {
    const detected = detectPlatform(item.url);
    const platform = (item.platform ?? (detected.platform === "unknown" ? null : detected.platform)) as SocialPlatform | null;
    if (!platform) {
      skipped.push({ url: item.url, reason: "unrecognized URL (not Instagram, TikTok, or YouTube Shorts)" });
      return null;
    }

    const shortcode = platform === "instagram"
      ? extractShortcode(item.url) || detected.shortcode
      : detected.shortcode;

    const reel = await buildReel(item.url, platform, item.creator, item.caption, shortcode, ytdlpAvailable);

    return repo.videos.upsertScraped(reel, {
      configName: parsed.data.configName,
      provider: platform === "instagram" ? "manual" : platform === "tiktok" ? "tiktok" : "youtube",
      selectedForAnalysis: true,
    });
  }));

  return NextResponse.json({
    imported: imported.filter(Boolean).length,
    skipped,
    videos: imported,
    ytdlpAvailable,
  });
}
