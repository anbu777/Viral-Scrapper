import { v4 as uuid } from "uuid";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { readConfigs, readCreators, readVideos, writeVideos, readScripts, writeScripts, readVoiceProfile } from "./csv";
import { scrapeReels } from "./apify";
import { uploadVideo, analyzeVideo } from "./gemini";
import { generatePersonalizedScript } from "./scriptgen";

import { generateNanoBananaPro, submitKling3Video } from "./fal";
import type { PipelineParams, PipelineProgress, Video, ActiveTask, Script } from "./types";

const VIDEO_CONCURRENCY = 3;

const TRANSCRIPT_PROMPT =
  'Transcribe every single word spoken in this video, word for word. Output ONLY the raw spoken transcript with no timestamps, no labels, no analysis, no formatting — just the exact words as spoken. If nothing is spoken, write "[No spoken words]".';

interface ScrapedVideo {
  videoUrl: string;
  postUrl: string;
  views: number;
  likes: number;
  comments: number;
  username: string;
  thumbnail: string;
  datePosted: string;
  timestamp: Date;
  duration?: number;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

export async function runPipeline(
  params: PipelineParams,
  onProgress: (progress: PipelineProgress) => void
): Promise<void> {
  const progress: PipelineProgress = {
    status: "running",
    phase: "scraping",
    activeTasks: [],
    creatorsCompleted: 0,
    creatorsTotal: 0,
    creatorsScraped: 0,
    videosAnalyzed: 0,
    videosTotal: 0,
    scriptsGenerated: 0,
    scriptsTotal: 0,
    videoJobsQueued: 0,
    videoJobsTotal: 0,
    errors: [],
    log: [],
  };

  const emit = () => {
    onProgress({ ...progress, activeTasks: [...progress.activeTasks], log: [...progress.log], errors: [...progress.errors] });
  };

  const log = (msg: string) => {
    progress.log.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    emit();
  };

  const addTask = (task: ActiveTask) => {
    progress.activeTasks.push(task);
    emit();
  };

  const updateTask = (id: string, step: string) => {
    const t = progress.activeTasks.find((t) => t.id === id);
    if (t) { t.step = step; emit(); }
  };

  const removeTask = (id: string) => {
    progress.activeTasks = progress.activeTasks.filter((t) => t.id !== id);
    emit();
  };

  try {
    const configs = readConfigs();
    const config = configs.find((c) => c.configName === params.configName);
    if (!config) throw new Error(`Config "${params.configName}" not found`);
    log(`Loaded config: ${config.configName}`);

    // This array is populated by either the scrape+analyze path OR the resume path
    const videosToProcess: Video[] = [];

    // ─── RESUME MODE: skip scraping + analysis ──────────────────────────────────
    if (params.skipScraping) {
      const allSaved = readVideos().filter((v) => v.configName === params.configName && v.analysis);
      const scriptedIds = new Set(readScripts().map((s) => s.videoId));
      const unscripted = allSaved.filter((v) => !scriptedIds.has(v.id));

      progress.creatorsTotal = 0;
      progress.videosTotal = unscripted.length;
      progress.videosAnalyzed = unscripted.length;
      videosToProcess.push(...unscripted);

      log(`Resume mode — ${allSaved.length} saved videos for "${params.configName}", ${unscripted.length} without scripts yet.`);
      emit();

      if (unscripted.length === 0) {
        progress.phase = "done";
        progress.status = "completed";
        log("Nothing to resume — all saved videos already have scripts. Run a fresh pipeline to scrape new content.");
        emit();
        return;
      }

    // ─── NORMAL MODE: scrape + analyze ──────────────────────────────────────────
    } else {
      const allCreators = readCreators();
      const creators = allCreators.filter((c) => c.category === config.creatorsCategory);
      if (creators.length === 0) throw new Error(`No creators found for category "${config.creatorsCategory}"`);

      progress.creatorsTotal = creators.length;
      log(`Found ${creators.length} creators — scraping all in parallel`);
      emit();

      // Phase 1: Scrape
      progress.phase = "scraping";
      const cutoffDate = new Date(Date.now() - params.nDays * 24 * 60 * 60 * 1000);
      const allTopVideos: ScrapedVideo[] = [];

      const scrapeResults = await Promise.allSettled(
        creators.map(async (creator) => {
          const taskId = `scrape-${creator.username}`;
          addTask({ id: taskId, creator: creator.username, step: "Scraping reels" });

          const reels = await scrapeReels(creator.username, params.maxVideos, params.nDays);
          updateTask(taskId, `Found ${reels.length} reels`);

          const videos = reels
            .filter((r) => r.videoUrl && r.timestamp)
            .map((r) => ({
              videoUrl: r.videoUrl,         // direct CDN URL (for download + audio extraction)
              postUrl: r.url,
              views: r.videoPlayCount || 0,
              likes: r.likesCount || 0,
              comments: r.commentsCount || 0,
              username: r.ownerUsername || creator.username,
              thumbnail: r.images?.[0] || "",
              datePosted: r.timestamp?.split("T")[0] || "",
              timestamp: new Date(r.timestamp),
              duration: r.videoDuration || undefined,
            }))
            .filter((v) => v.timestamp >= cutoffDate);

          videos.sort((a, b) => b.views - a.views);
          const topVideos = videos.slice(0, params.topK);

          updateTask(taskId, `Top ${topVideos.length} selected`);
          log(`@${creator.username}: ${reels.length} reels → top ${topVideos.length} selected`);
          removeTask(taskId);
          progress.creatorsScraped++;
          emit();

          return { creator: creator.username, videos: topVideos };
        })
      );

      for (const result of scrapeResults) {
        if (result.status === "fulfilled") {
          allTopVideos.push(...result.value.videos);
          progress.creatorsCompleted++;
        } else {
          const msg = `Scraping error: ${result.reason instanceof Error ? result.reason.message : result.reason}`;
          progress.errors.push(msg);
          log(msg);
          progress.creatorsCompleted++;
        }
      }

      progress.videosTotal = allTopVideos.length;
      const needsGemini = params.autoAnalysis !== false || params.autoTranscript;
      log(`Scraping done. ${allTopVideos.length} videos — ${needsGemini ? `sending to Gemini (${VIDEO_CONCURRENCY} workers)` : "saving metadata only (Gemini skipped)"}`);
      emit();

      // Phase 2: Gemini analysis / transcript / metadata-only
      progress.phase = "analyzing";
      emit();

      if (needsGemini) {
        await runWithConcurrency(allTopVideos, VIDEO_CONCURRENCY, async (video) => {
          const taskId = `video-${uuid().slice(0, 8)}`;
          const label = `${video.views.toLocaleString()} views`;

          try {
            addTask({ id: taskId, creator: video.username, step: "Downloading", views: video.views });

            const videoResponse = await fetch(video.videoUrl);
            if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
            const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
            const contentType = videoResponse.headers.get("content-type") || "video/mp4";

            updateTask(taskId, "Uploading to Gemini");
            log(`@${video.username} (${label}): uploading to Gemini`);
            const fileData = await uploadVideo(videoBuffer, contentType);

            let analysis = "";
            let transcript: string | undefined;

            if (params.autoAnalysis !== false) {
              updateTask(taskId, "Gemini analyzing");
              log(`@${video.username} (${label}): Gemini analyzing`);
              analysis = await analyzeVideo(fileData.uri, fileData.mimeType, config.analysisInstruction);
            }

            if (params.autoTranscript) {
              updateTask(taskId, "Extracting transcript");
              log(`@${video.username} (${label}): extracting transcript`);
              transcript = await analyzeVideo(fileData.uri, fileData.mimeType, TRANSCRIPT_PROMPT);
            }

            const videoId = uuid();

            // Download thumbnail locally so CDN expiry never breaks the UI
            let localThumbnail = video.thumbnail;
            if (video.thumbnail) {
              try {
                const thumbRes = await fetch(video.thumbnail);
                if (thumbRes.ok) {
                  const thumbBuf = Buffer.from(await thumbRes.arrayBuffer());
                  const ct = thumbRes.headers.get("content-type") || "image/jpeg";
                  const ext = ct.includes("png") ? "png" : "jpg";
                  const thumbDir = path.join(process.cwd(), "public", "thumbnails");
                  if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true });
                  writeFileSync(path.join(thumbDir, `${videoId}.${ext}`), thumbBuf);
                  localThumbnail = `/thumbnails/${videoId}.${ext}`;
                }
              } catch {
                // keep CDN URL as fallback
              }
            }

            const videoRecord: Video = {
              id: videoId,
              link: video.postUrl,
              thumbnail: localThumbnail,
              creator: video.username,
              views: video.views,
              likes: video.likes,
              comments: video.comments,
              analysis,
              transcript,
              newConcepts: "",
              datePosted: video.datePosted,
              dateAdded: new Date().toISOString().slice(0, 10),
              configName: params.configName,
              starred: false,
              duration: video.duration,
              videoFileUrl: video.videoUrl,
            };

            videosToProcess.push(videoRecord);
            progress.videosAnalyzed++;
            removeTask(taskId);
            log(`@${video.username} (${label}): done`);
            emit();
          } catch (err) {
            removeTask(taskId);
            const msg = `@${video.username} (${label}): ${err instanceof Error ? err.message : err}`;
            progress.errors.push(msg);
            log(`Error — ${msg}`);
            emit();
          }
        });
      } else {
        // No Gemini at all — save scraped metadata directly
        for (const video of allTopVideos) {
          const videoId = uuid();
          let localThumbnail = video.thumbnail;
          if (video.thumbnail) {
            try {
              const thumbRes = await fetch(video.thumbnail);
              if (thumbRes.ok) {
                const thumbBuf = Buffer.from(await thumbRes.arrayBuffer());
                const ct = thumbRes.headers.get("content-type") || "image/jpeg";
                const ext = ct.includes("png") ? "png" : "jpg";
                const thumbDir = path.join(process.cwd(), "public", "thumbnails");
                if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true });
                writeFileSync(path.join(thumbDir, `${videoId}.${ext}`), thumbBuf);
                localThumbnail = `/thumbnails/${videoId}.${ext}`;
              }
            } catch {
              // keep CDN URL as fallback
            }
          }

          const videoRecord: Video = {
            id: videoId,
            link: video.postUrl,
            thumbnail: localThumbnail,
            creator: video.username,
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            analysis: "",
            newConcepts: "",
            datePosted: video.datePosted,
            dateAdded: new Date().toISOString().slice(0, 10),
            configName: params.configName,
            starred: false,
            duration: video.duration,
            videoFileUrl: video.videoUrl,
          };

          videosToProcess.push(videoRecord);
          progress.videosAnalyzed++;
          emit();
        }
        log(`Saved ${videosToProcess.length} video records (metadata only).`);
      }

      // Save newly analyzed videos
      if (videosToProcess.length > 0) {
        const existing = readVideos();
        writeVideos([...existing, ...videosToProcess]);
      }
    }

    // ─── Phase 3: Auto-generate scripts ────────────────────────────────────────
    const generatedScripts: Script[] = [];

    if (params.autoGenerateScripts && params.autoAnalysis !== false && videosToProcess.length > 0) {
      progress.phase = "generating_scripts";
      progress.scriptsTotal = videosToProcess.length;
      log(`Generating scripts for ${videosToProcess.length} videos...`);
      emit();

      const voiceProfile = readVoiceProfile();
      if (!voiceProfile) {
        log("⚠ No voice profile found — skipping script generation. Set up your Voice Profile first.");
      } else {
        for (const video of videosToProcess) {
          const taskId = `script-${video.id.slice(0, 8)}`;
          addTask({ id: taskId, creator: video.creator, step: "Generating script" });
          try {
            const generated = await generatePersonalizedScript(video.analysis, voiceProfile);
            const script: Script = {
              id: uuid(),
              videoId: video.id,
              videoCreator: video.creator,
              videoViews: video.views,
              videoLink: video.link,
              title: generated.title,
              hook: generated.hook,
              script: generated.script,
              platform: generated.platform,
              estimatedDuration: generated.estimatedDuration,
              contentType: generated.contentType,
              dateGenerated: new Date().toISOString().slice(0, 10),
              starred: false,
              videoStatus: "idle",
            };
            generatedScripts.push(script);
            progress.scriptsGenerated++;
            log(`@${video.creator}: script "${generated.title}" generated`);
          } catch (err) {
            const msg = `@${video.creator} script gen failed: ${err instanceof Error ? err.message : err}`;
            progress.errors.push(msg);
            log(`Error — ${msg}`);
          } finally {
            removeTask(taskId);
            emit();
          }
        }

        if (generatedScripts.length > 0) {
          const existingScripts = readScripts();
          writeScripts([...existingScripts, ...generatedScripts]);
          log(`Saved ${generatedScripts.length} scripts to library.`);
        }
      }
    }

    // ─── Phase 4: Auto-queue Higgsfield video jobs ────────────────────────────
    if (params.autoGenerateVideos && generatedScripts.length > 0) {
      progress.phase = "generating_videos";
      progress.videoJobsTotal = generatedScripts.length;
      log(`Queueing Higgsfield video jobs for ${generatedScripts.length} scripts...`);
      emit();

      const avatarId = "default";
      const sharp = (await import("sharp")).default;

      if (!process.env.FAL_KEY) {
        log("⚠ FAL_KEY not set — skipping video generation. Add it to .env.local.");
      } else {
        const allScripts = readScripts();

        for (const script of generatedScripts) {
          const taskId = `video-${script.id.slice(0, 8)}`;
          addTask({ id: taskId, creator: script.videoCreator, step: "Preparing start frame" });
          try {
            // Nano Banana Pro → image, then Kling 3.0 → video
            let startFrameUrl: string = "";
            let imagePromptSaved: string | undefined;
            let videoPromptFilled: string | undefined;

            try {
              const { generateFilledPrompts } = await import("./promptgen");
              const filled = await generateFilledPrompts(script);
              imagePromptSaved = filled.imagePrompt;
              videoPromptFilled = filled.videoPrompt;

              updateTask(taskId, "Generating image (Nano Banana Pro)");
              startFrameUrl = await generateNanoBananaPro(filled.imagePrompt);
              log(`@${script.videoCreator}: Nano Banana Pro image -> ${startFrameUrl.slice(0, 60)}`);
            } catch (imgErr) {
              log(`⚠ Image gen skipped for @${script.videoCreator}: ${imgErr instanceof Error ? imgErr.message : imgErr}`);
            }

            if (!startFrameUrl) throw new Error("Image generation failed — no start frame");

            // fal.ai Kling 3.0: image → 10s video
            updateTask(taskId, "Submitting Kling 3.0 job (fal.ai)");
            const motionPrompt = videoPromptFilled ??
              "Person speaking naturally and confidently to camera, subtle head movement, natural expressions, photorealistic";
            const requestId = await submitKling3Video(startFrameUrl, motionPrompt, 10);

            const idx = allScripts.findIndex((s) => s.id === script.id);
            if (idx !== -1) {
              allScripts[idx] = {
                ...allScripts[idx],
                videoJobId: requestId,
                videoStatus: "processing",
                videoProvider: "fal",
                videoMode: "kling3",
                avatarId,
                ...(imagePromptSaved ? { imagePrompt: imagePromptSaved } : {}),
                ...(videoPromptFilled ? { videoPrompt: videoPromptFilled } : {}),
                generatedImageUrl: startFrameUrl,
              };
            }

            progress.videoJobsQueued++;
            log(`@${script.videoCreator}: fal.ai Kling 3.0 job queued ✓`);
          } catch (err) {
            const msg = `@${script.videoCreator} video gen failed: ${err instanceof Error ? err.message : err}`;
            progress.errors.push(msg);
            log(`Error — ${msg}`);
            const idx = allScripts.findIndex((s) => s.id === script.id);
            if (idx !== -1) allScripts[idx] = { ...allScripts[idx], videoStatus: "failed" };
          } finally {
            removeTask(taskId);
            emit();
          }
        }

        writeScripts(allScripts);
        log(`${progress.videoJobsQueued}/${progress.videoJobsTotal} video jobs queued. Open Scripts page to monitor progress.`);
      }
    }

    progress.phase = "done";
    progress.status = "completed";
    log(`Pipeline complete! ${progress.videosAnalyzed} analyzed · ${progress.scriptsGenerated} scripts · ${progress.videoJobsQueued} videos queued · ${progress.errors.length} errors.`);
    emit();
  } catch (err) {
    progress.status = "error";
    const msg = `Pipeline error: ${err instanceof Error ? err.message : err}`;
    progress.errors.push(msg);
    log(msg);
    emit();
  }
}
