/**
 * Multi-platform URL import endpoint.
 *
 * Despite the historical path (`instagram-urls`), this endpoint accepts URLs
 * from Instagram, TikTok and YouTube Shorts. Each URL is auto-detected and
 * stored with the correct `platform` field. When **yt-dlp** is installed, each URL
 * (including **Instagram** reels) is passed through `getVideoMetadata` so thumbnails,
 * stats, and a direct video URL are stored when the extractor succeeds.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import pLimit from "p-limit";
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

type EnrichmentResult = {
  url: string;
  status: "enriched" | "basic" | "skipped";
  platform?: SocialPlatform;
  error?: string;
  creator?: string;
};

async function buildReel(
  url: string,
  platform: SocialPlatform,
  creator: string,
  caption: string | undefined,
  shortcode: string,
  ytdlpAvailable: boolean,
  detectedUsername?: string
): Promise<{ reel: ScrapedReel; enrichmentStatus: "enriched" | "basic"; enrichmentError?: string }> {
  const base: ScrapedReel = {
    platform,
    sourcePostUrl: url,
    shortcode,
    creatorUsername: creator !== "manual" ? creator : (detectedUsername || creator),
    caption: caption || "",
    thumbnailUrl: "",
    videoFileUrl: null,
    postedAt: "",
    views: 0,
    likes: 0,
    comments: 0,
    rawProviderPayload: { manualImport: true, platform },
  };

  /** TikTok / YouTube always need yt-dlp enrichment; Instagram can use it too when installed. */
  if (!ytdlpAvailable) {
    return {
      reel: base,
      enrichmentStatus: "basic",
      enrichmentError: "yt-dlp not installed — imported without thumbnails/stats",
    };
  }

  try {
    const meta = await getVideoMetadata(url);
    const enrichedCreator = meta.uploader || detectedUsername || creator;
    return {
      reel: {
        ...base,
        shortcode: meta.id || shortcode,
        creatorUsername: enrichedCreator !== "manual" ? enrichedCreator : base.creatorUsername,
        caption: caption || meta.title || meta.description || "",
        thumbnailUrl: meta.thumbnail || "",
        videoFileUrl: meta.videoUrl || null,
        postedAt: meta.uploadDate || "",
        views: meta.viewCount ?? 0,
        likes: meta.likeCount ?? 0,
        comments: meta.commentCount ?? 0,
        durationSeconds: meta.durationSeconds,
        rawProviderPayload: { manualImport: true, platform, ytdlp: meta.raw },
      },
      enrichmentStatus: "enriched",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[import] yt-dlp enrichment failed for ${url}: ${message}`);
    return {
      reel: base,
      enrichmentStatus: "basic",
      enrichmentError: message,
    };
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
  const enrichmentResults: EnrichmentResult[] = [];

  // Rate-limit yt-dlp calls: max 3 concurrent to avoid throttling/timeouts
  const limit = pLimit(3);
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const imported = await Promise.all(parsed.data.urls.map((item, idx) =>
    limit(async () => {
      // Add small delay between batches to avoid rate limiting
      if (idx > 0 && idx % 3 === 0) await delay(500);

      const detected = detectPlatform(item.url);
      const platform = (item.platform ?? (detected.platform === "unknown" ? null : detected.platform)) as SocialPlatform | null;
      if (!platform) {
        skipped.push({ url: item.url, reason: "unrecognized URL (not Instagram, TikTok, or YouTube Shorts)" });
        enrichmentResults.push({ url: item.url, status: "skipped", error: "unrecognized URL" });
        return null;
      }

      const shortcode = platform === "instagram"
        ? extractShortcode(item.url) || detected.shortcode
        : detected.shortcode;

      // Use normalised URL for yt-dlp (fixes YouTube watch?v= → /shorts/ format)
      const urlForEnrichment = detected.normalisedUrl || item.url;

      const { reel, enrichmentStatus, enrichmentError } = await buildReel(
        urlForEnrichment, platform, item.creator, item.caption, shortcode, ytdlpAvailable, detected.detectedUsername
      );

      enrichmentResults.push({
        url: item.url,
        status: enrichmentStatus,
        platform,
        error: enrichmentError,
        creator: reel.creatorUsername,
      });

      return repo.videos.upsertScraped(reel, {
        configName: parsed.data.configName,
        provider: platform === "instagram" ? "manual" : platform === "tiktok" ? "tiktok" : "youtube",
        selectedForAnalysis: true,
      });
    })
  ));

  return NextResponse.json({
    imported: imported.filter(Boolean).length,
    skipped,
    enrichmentResults,
    videos: imported,
    ytdlpAvailable,
  });
}
