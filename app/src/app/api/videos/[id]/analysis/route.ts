import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import { getEnv } from "@/lib/env";
import { getProviderForPlatform } from "@/lib/providers";
import { analyzeWithProvider } from "@/lib/ai-providers";
import { uploadVideo, generateNewConcepts } from "@/lib/gemini";
import { analyzeVideoToStructuredJson } from "@/lib/gemini-json-analysis";
import { withBackoff } from "@/lib/retry";
import { isYtdlpAvailable, downloadVideoToBuffer } from "@/lib/providers/ytdlp";
import type { SocialPlatform, VideoAnalysis } from "@/lib/types";

export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const video = await repo.videos.find(id);
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (video.analysis && video.analysisStatus === "ok") return NextResponse.json({ analysis: video.analysis });

    const config = (await repo.configs.list()).find((c) => c.configName === video.configName);
    const provider = getProviderForPlatform((video.platform as SocialPlatform) || "instagram");
    const transcript = video.transcript || "";
    const env = getEnv();
    const instruction = config?.analysisInstruction || "Analyze this short-form video for viral content patterns.";
    let analysis: VideoAnalysis;
    let newConcepts = video.newConcepts || "";
    let status: "ok" | "fallback" = "fallback";
    let downloadMethod = "none";
    const downloadErrors: string[] = [];
    const platform = (video.platform as SocialPlatform) || "instagram";

    // ── Step 1: Try to download the video for full Gemini analysis ────────────
    let downloaded: { buffer: Buffer; contentType: string } | undefined;

    // 1a: Try the provider's native download (using stored videoFileUrl)
    try {
      downloaded = await provider.downloadVideo({ postUrl: video.link, videoFileUrl: video.videoFileUrl });
      if (downloaded) downloadMethod = "provider";
    } catch (err) {
      downloadErrors.push(`Provider download: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 1b: If provider failed, try refreshing the video URL (TikTok/YouTube URLs expire)
    if (!downloaded && video.link) {
      try {
        const freshUrl = await provider.refreshVideoUrl(video.link);
        if (freshUrl) {
          downloaded = await downloadVideoToBuffer(freshUrl);
          if (downloaded) {
            downloadMethod = "refreshed-url";
            // Persist the fresh URL for next time
            await repo.videos.update(id, { videoFileUrl: freshUrl });
          }
        }
      } catch (err) {
        downloadErrors.push(`URL refresh: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 1c: Last resort — try yt-dlp directly on the post URL
    if (!downloaded && video.link && (await isYtdlpAvailable())) {
      try {
        downloaded = await downloadVideoToBuffer(video.link);
        if (downloaded) downloadMethod = "ytdlp-direct";
      } catch (err) {
        downloadErrors.push(`yt-dlp direct: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (downloadErrors.length > 0) {
      console.warn(`[analysis] Video download issues for ${video.link}:`, downloadErrors);
    }

    // ── Step 2: Analyze (prefer Gemini with video, fallback to text-only) ────
    if (downloaded && env.AI_PROVIDER === "gemini") {
      // Wrap Gemini upload + analysis in withBackoff for transient errors
      const structured = await withBackoff(async () => {
        const file = await uploadVideo(downloaded!.buffer, downloaded!.contentType);
        return analyzeVideoToStructuredJson({
          fileUri: file.uri,
          mimeType: file.mimeType,
          analysisInstruction: instruction,
        });
      }, {
        retries: 2,
        baseMs: 3000,
        shouldRetry: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return /429|503|502|504|timeout|ECONNRESET|fetch failed|rate/i.test(msg);
        },
      });

      analysis = structured.analysis;
      status = structured.outcome === "ok" ? "ok" : "fallback";

      if (structured.error) {
        console.warn(`[analysis] Structured analysis warning: ${structured.error}`);
      }

      if (config?.newConceptsInstruction?.trim() && status === "ok") {
        try {
          newConcepts = await generateNewConcepts(JSON.stringify(analysis), config.newConceptsInstruction);
        } catch {
          // Non-critical — don't fail the whole analysis for concepts
          newConcepts = "";
        }
      }
    } else {
      // No video available OR non-Gemini provider — text-only analysis with metadata
      if (!downloaded) {
        console.warn(`[analysis] No video downloaded for ${video.link} (method: ${downloadMethod}). Using metadata-only analysis.`);
      }
      // Use allowFallback: true so it never hard-throws — always returns something useful
      analysis = await withBackoff(async () => {
        return analyzeWithProvider({
          provider: env.AI_PROVIDER,
          prompt: instruction,
          transcript,
          metadataSummary: `@${video.creator}, ${video.views} views, ${video.likes} likes, caption: ${video.caption || ""}`,
          allowFallback: true,
        });
      }, {
        retries: 2,
        baseMs: 2000,
        shouldRetry: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return /429|503|502|504|timeout|ECONNRESET|fetch failed|rate/i.test(msg);
        },
      });
    }

    await repo.videos.update(id, {
      analysis: JSON.stringify(analysis, null, 2),
      analysisJson: analysis,
      transcript: analysis.transcript || transcript,
      newConcepts,
      analysisStatus: status,
    });

    return NextResponse.json({
      analysis: JSON.stringify(analysis, null, 2),
      analysisJson: analysis,
      analysisStatus: status,
      downloadMethod,
      downloadErrors: downloadErrors.length > 0 ? downloadErrors : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[analysis] Fatal error:`, msg);
    const httpStatus = /429|quota|rate/i.test(msg) ? 429 : 500;

    // Build informative error message for the user
    const video = await repo.videos.find(id).catch(() => undefined);
    const platform = video?.platform || "unknown";
    const suggestion = platform === "tiktok" || platform === "youtube_shorts"
      ? "Try re-importing the video URL, or check that yt-dlp is installed and up to date."
      : "Try again later or re-import the video URL.";
    const userMessage = `Analysis failed for ${platform} video: ${msg}. ${suggestion}`;

    await repo.videos.update(id, { analysisStatus: "failed" }).catch(() => {});
    return NextResponse.json({ error: userMessage }, { status: httpStatus });
  }
}
