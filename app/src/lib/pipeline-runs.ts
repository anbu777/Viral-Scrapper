import { randomUUID } from "crypto";
import pLimit from "p-limit";
import type { PipelineParams, Script, ScriptVariant, Video, VideoAnalysis } from "@/lib/types";
import { getEnv } from "@/lib/env";
import { repo } from "@/db/repositories";
import { getInstagramProvider, getProviderForPlatform, logProviderCall } from "@/lib/providers";
import { classifyProviderError } from "@/lib/providers/errors";
import { calculateViralityScore } from "@/lib/ranking";
import { analyzeWithProvider, generateScriptVariants } from "@/lib/ai-providers";
import { uploadVideo, generateNewConcepts } from "@/lib/gemini";
import { analyzeVideoToStructuredJson, transcribeVideoWithGemini } from "@/lib/gemini-json-analysis";
import { withBackoff } from "@/lib/retry";
import { readVoiceProfile } from "@/lib/csv";
import { transcribeWithProvider } from "@/lib/transcript-providers";

const running = new Set<string>();

function variantsFromParams(params: PipelineParams): ScriptVariant[] {
  return params.scriptVariants?.length ? params.scriptVariants : ["safe", "viral", "brand_voice"];
}

function voiceContextFromProfile(): string | undefined {
  const vp = readVoiceProfile();
  if (!vp) return undefined;
  return [
    `Niche: ${vp.niche}`,
    `Tone: ${vp.tone}`,
    `Audience: ${vp.targetAudience}`,
    vp.contentGoal ? `Goal: ${vp.contentGoal}` : "",
    vp.phrases ? `Phrases to lean on: ${vp.phrases}` : "",
    vp.avoidPhrases ? `Avoid: ${vp.avoidPhrases}` : "",
  ].filter(Boolean).join("\n");
}

async function runCancelled(runId: string): Promise<boolean> {
  const run = await repo.runs.get(runId);
  return !run || run.status === "cancelled" || Boolean(run.cancelRequested);
}

export async function createPipelineRun(params: PipelineParams) {
  const env = getEnv();
  const normalized: PipelineParams = {
    ...params,
    scraperProvider: params.scraperProvider || env.SCRAPER_PROVIDER,
    aiProvider: params.aiProvider || env.AI_PROVIDER,
    transcriptProvider: params.transcriptProvider || env.TRANSCRIPT_PROVIDER,
    videoProvider: params.freeMode ? "none" : params.videoProvider || env.VIDEO_PROVIDER,
    freeMode: params.freeMode ?? true,
    qualityGateMode: params.qualityGateMode || "balanced",
    maxConcurrency: params.maxConcurrency || 2,
    scriptVariants: variantsFromParams(params),
  };
  const run = await repo.runs.create(normalized);
  void processPipelineRun(run.id);
  return run;
}

async function analyzeOneVideo(
  runId: string,
  video: Video,
  config: { analysisInstruction: string; newConceptsInstruction: string },
  params: PipelineParams
): Promise<void> {
  const videoPlatform = (video.platform as "instagram" | "tiktok" | "youtube_shorts" | undefined) || "instagram";
  const provider = videoPlatform === "instagram"
    ? getInstagramProvider(params.scraperProvider)
    : getProviderForPlatform(videoPlatform, params.scraperProvider);
  const analysisRunId = randomUUID();
  await repo.analysisRuns.insert({
    id: analysisRunId,
    videoId: video.id,
    provider: params.aiProvider || "gemini",
    status: "running",
  });

  let transcript = video.transcript || "";
  let analysis: VideoAnalysis;
  let analysisStatus: Video["analysisStatus"] = "fallback";
  let newConceptsText = "";

  const useGeminiMultimodal =
    params.aiProvider === "gemini" &&
    Boolean(process.env.GEMINI_API_KEY) &&
    Boolean(video.videoFileUrl);

  try {
    if (useGeminiMultimodal) {
      const { buffer, contentType } = await withBackoff(() =>
        logProviderCall(provider, "downloadVideo", { postUrl: video.link, videoFileUrl: video.videoFileUrl }, () =>
          provider.downloadVideo({ postUrl: video.link, videoFileUrl: video.videoFileUrl })
        )
      );
      const file = await withBackoff(() => uploadVideo(buffer, contentType));

      if (params.autoTranscript && params.transcriptProvider === "gemini") {
        transcript = await withBackoff(() => transcribeVideoWithGemini(file.uri, file.mimeType));
      } else if (params.autoTranscript && params.transcriptProvider === "whisper-local") {
        transcript = await transcribeWithProvider({
          provider: "whisper-local",
          videoBuffer: buffer,
          contentType,
        });
      }

      const structured = await withBackoff(() =>
        analyzeVideoToStructuredJson({
          fileUri: file.uri,
          mimeType: file.mimeType,
          analysisInstruction: config.analysisInstruction,
        })
      );
      analysis = structured.analysis;
      analysisStatus = structured.outcome === "ok" ? "ok" : "fallback";

      if (config.newConceptsInstruction.trim()) {
        try {
          newConceptsText = await withBackoff(() =>
            generateNewConcepts(JSON.stringify(analysis), config.newConceptsInstruction)
          );
        } catch {
          newConceptsText = "";
        }
      }
    } else {
      analysis = await analyzeWithProvider({
        provider: params.aiProvider!,
        prompt: config.analysisInstruction,
        transcript,
        metadataSummary: `@${video.creator}, ${video.views} views, ${video.likes} likes, caption: ${video.caption || ""}`,
      });
      analysisStatus = "fallback";
      if (config.newConceptsInstruction.trim()) {
        try {
          newConceptsText = await generateNewConcepts(JSON.stringify(analysis), config.newConceptsInstruction);
        } catch {
          newConceptsText = "";
        }
      }
    }

    await repo.videos.update(video.id, {
      analysis: JSON.stringify(analysis, null, 2),
      analysisJson: analysis,
      transcript: analysis.transcript || transcript,
      newConcepts: newConceptsText,
      analysisStatus,
    });
    await repo.analysisRuns.update(analysisRunId, {
      status: "succeeded",
      analysisJson: JSON.stringify(analysis),
    });

    if (params.autoGenerateScripts) {
      const variants = await generateScriptVariants({
        provider: params.aiProvider!,
        analysis,
        variants: variantsFromParams(params),
        sourceTranscript: analysis.transcript || transcript,
        qualityGateMode: params.qualityGateMode || "balanced",
        voiceContext: voiceContextFromProfile(),
      });
      for (const variant of variants) {
        const script: Script = {
          id: randomUUID(),
          videoId: video.id,
          generationRunId: runId,
          scriptVariant: variant.variant,
          videoCreator: video.creator,
          videoViews: video.views,
          videoLink: video.link,
          title: variant.title,
          hook: variant.hook,
          script: variant.spokenScript,
          spokenScript: variant.spokenScript,
          cta: variant.cta,
          sourceInspiration: variant.sourceInspiration,
          similarityScore: variant.similarityScore,
          qualityScore: variant.qualityScore,
          platform: "instagram",
          estimatedDuration: `${variant.estimatedDurationSeconds}s`,
          estimatedDurationSeconds: variant.estimatedDurationSeconds,
          contentType: "AI Variant",
          dateGenerated: new Date().toISOString().slice(0, 10),
          starred: false,
          videoStatus: params.videoProvider === "fal" ? "idle" : undefined,
          imagePrompt: variant.imagePrompt,
          videoPrompt: variant.videoPrompt,
        };
        await repo.scripts.upsert(script);
      }
    }
  } catch (error) {
    await repo.analysisRuns.update(analysisRunId, {
      status: "failed",
      errorCode: classifyProviderError(error),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    await repo.runs.addError(runId, {
      code: classifyProviderError(error),
      message: error instanceof Error ? error.message : String(error),
      target: video.link,
    });
    await repo.videos.update(video.id, { analysisStatus: "failed" });
  }
}

export async function processPipelineRun(runId: string) {
  if (running.has(runId)) return;
  running.add(runId);
  const runRow = await repo.runs.get(runId);
  if (!runRow) {
    running.delete(runId);
    return;
  }

  const params = runRow.params;
  const defaultProvider = getInstagramProvider(params.scraperProvider);
  const startedAt = new Date().toISOString();
  await repo.runs.update(runId, {
    status: "running",
    startedAt,
    progress: { phase: "loading", completed: 0, total: 0 },
  });

  try {
    const configs = await repo.configs.list();
    const config = configs.find((item) => item.configName === params.configName);
    if (!config) throw new Error(`Config "${params.configName}" not found`);

    const selectedVideos: Video[] = [];

    if (params.skipScraping) {
      const all = await repo.videos.list({ configName: params.configName });
      const scripts = await repo.scripts.list();
      const scriptedIds = new Set(scripts.map((s) => s.videoId));
      if (params.autoGenerateScripts) {
        for (const v of all) {
          if (v.analysis && !scriptedIds.has(v.id)) selectedVideos.push(v);
        }
      } else if (params.autoAnalysis !== false) {
        selectedVideos.push(
          ...all.filter((v) => !(v.analysis && String(v.analysis).trim()) && (v.selectedForAnalysis ?? true))
        );
      } else {
        selectedVideos.push(...all.filter((v) => v.selectedForAnalysis ?? true));
      }
      await repo.runs.update(runId, {
        progress: { phase: "scraping", completed: 0, total: 0 },
      });
    } else {
      const creators = await repo.creators.list(config.creatorsCategory);
      await repo.runs.update(runId, {
        progress: { phase: "scraping", completed: 0, total: creators.length },
      });

      for (let i = 0; i < creators.length; i++) {
        if (await runCancelled(runId)) break;
        const creator = creators[i];
        const creatorProvider = creator.platform && creator.platform !== "instagram"
          ? getProviderForPlatform(creator.platform, params.scraperProvider)
          : defaultProvider;
        const itemId = randomUUID();
        await repo.scrapeRunItems.insert({
          id: itemId,
          scrapeRunId: runId,
          creatorUsername: creator.username,
          status: "running",
          step: "scrape_reels",
        });
        try {
          const reels = await logProviderCall(creatorProvider, "scrapeReels", {
            username: creator.username,
            maxVideos: params.maxVideos,
            nDays: params.nDays,
          }, () => creatorProvider.scrapeReels({
            username: creator.username,
            maxVideos: params.maxVideos,
            nDays: params.nDays,
          }));

          const ranked = reels
            .map((reel) => ({ reel, virality: calculateViralityScore(reel, creator) }))
            .sort((a, b) => b.virality.score - a.virality.score)
            .slice(0, params.topK);

          let lastVideoId: string | null = null;
          for (const item of ranked) {
            const video = await repo.videos.upsertScraped(item.reel, {
              configName: params.configName,
              scrapeRunId: runId,
              provider: creatorProvider.name,
              selectedForAnalysis: true,
              viralityScore: item.virality.score,
              rankingReason: item.virality.reason,
              scoreBreakdown: item.virality.breakdown,
            });
            if (video) {
              selectedVideos.push(video);
              lastVideoId = video.id;
            }
          }
          await repo.scrapeRunItems.update(itemId, {
            status: "succeeded",
            step: "scrape_reels",
            videoId: lastVideoId,
          });
        } catch (error) {
          await repo.scrapeRunItems.update(itemId, {
            status: "failed",
            step: "scrape_reels",
            errorCode: classifyProviderError(error),
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          await repo.runs.addError(runId, {
            code: classifyProviderError(error),
            message: error instanceof Error ? error.message : String(error),
            target: creator.username,
          });
        }

        await repo.runs.update(runId, {
          progress: { phase: "scraping", completed: i + 1, total: creators.length },
        });
      }
    }

    const shouldAnalyze = params.autoAnalysis !== false;
    if (shouldAnalyze && selectedVideos.length > 0) {
      await repo.runs.update(runId, {
        progress: { phase: "analyzing", completed: 0, total: selectedVideos.length },
      });

      const limit = pLimit(Math.max(1, Math.min(10, params.maxConcurrency || 2)));
      let progressTail = Promise.resolve();
      let analyzed = 0;
      const bumpAnalyzed = () => {
        progressTail = progressTail.then(async () => {
          analyzed += 1;
          await repo.runs.update(runId, {
            progress: { phase: "analyzing", completed: analyzed, total: selectedVideos.length },
          });
        });
        return progressTail;
      };
      await Promise.all(
        selectedVideos.map((video) =>
          limit(async () => {
            if (await runCancelled(runId)) return;
            await analyzeOneVideo(runId, video, config, params);
            await bumpAnalyzed();
          })
        )
      );
    }

    await repo.runs.update(runId, {
      status: (await runCancelled(runId)) ? "cancelled" : "completed",
      completedAt: new Date().toISOString(),
      progress: { phase: "done", completed: selectedVideos.length, total: selectedVideos.length },
    });
  } catch (error) {
    await repo.runs.addError(runId, {
      code: classifyProviderError(error),
      message: error instanceof Error ? error.message : String(error),
    });
    await repo.runs.update(runId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      progress: { phase: "failed" },
    });
  } finally {
    running.delete(runId);
  }
}

export async function retryPipelineRun(runId: string) {
  const run = await repo.runs.get(runId);
  if (!run) return null;
  await repo.runs.update(runId, {
    status: "queued",
    errors: [],
    cancelRequested: false,
    progress: { phase: "queued", completed: 0, total: 0 },
    completedAt: null,
  });
  void processPipelineRun(runId);
  return await repo.runs.get(runId);
}
