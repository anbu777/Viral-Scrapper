/**
 * Backfill local thumbnail cache for previously scraped videos.
 *
 * Streams Server-Sent Events so the UI can show progress. For each video:
 *   • If the existing thumbnail field is already a `/thumbnails/...` local path, skip.
 *   • If the platform is TikTok / YouTube and `yt-dlp` is available, re-query
 *     the source post for a fresh thumbnail URL.
 *   • Download the URL via `cacheThumbnail` and persist the local path back
 *     onto the video row.
 *
 * Instagram links that have expired are noted in the response but not patched
 * (the only fix is a re-scrape via Apify / a logged-in local provider, which
 * lives in the regular pipeline run).
 */

import { repo } from "@/db/repositories";
import { cacheThumbnail } from "@/lib/thumbnail-cache";
import { getVideoMetadata, isYtdlpAvailable } from "@/lib/providers/ytdlp";

export const maxDuration = 600;

type Outcome = "cached" | "skipped" | "refreshed" | "failed";

export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      const videos = await repo.videos.list({});
      const ytdlpReady = await isYtdlpAvailable();
      send({ type: "start", total: videos.length, ytdlpAvailable: ytdlpReady });

      let processed = 0;
      const stats: Record<Outcome, number> = {
        cached: 0,
        skipped: 0,
        refreshed: 0,
        failed: 0,
      };

      for (const video of videos) {
        processed += 1;
        const id = video.id;
        const platform = video.platform || "instagram";
        const existing = video.thumbnail || "";

        // Already cached locally — nothing to do.
        if (existing.startsWith("/thumbnails/")) {
          stats.skipped += 1;
          send({ type: "progress", id, status: "skipped", processed, total: videos.length });
          continue;
        }

        let sourceUrl = existing;
        let outcome: Outcome = "failed";

        if ((platform === "tiktok" || platform === "youtube_shorts") && ytdlpReady && video.link) {
          try {
            const meta = await getVideoMetadata(video.link);
            if (meta.thumbnail) {
              sourceUrl = meta.thumbnail;
              outcome = "refreshed";
            }
          } catch {
            // Fall through to existing URL if yt-dlp lookup fails.
          }
        }

        if (sourceUrl) {
          const localPath = await cacheThumbnail(sourceUrl, id);
          if (localPath.startsWith("/thumbnails/")) {
            await repo.videos.update(id, { thumbnail: localPath });
            stats.cached += 1;
            outcome = outcome === "refreshed" ? "refreshed" : "cached";
          } else {
            stats.failed += 1;
            outcome = "failed";
          }
        } else {
          stats.failed += 1;
          outcome = "failed";
        }

        send({
          type: "progress",
          id,
          platform,
          status: outcome,
          processed,
          total: videos.length,
        });
      }

      send({ type: "complete", stats });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
