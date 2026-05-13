/**
 * Auto-scraping scheduler.
 *
 * Architecture:
 *   - Each creator has a scheduler_job row with `next_run_at` timestamp.
 *   - On every request to the app (via middleware), `runSchedulerTick` is fired.
 *   - It picks up due jobs, scrapes them, calculates virality, creates alerts.
 *   - Schedule respects per-platform intervals from app_settings.
 *
 * No external cron required — self-scheduling via DB.
 */

import { repo } from "@/db/repositories";
import { getProviderForPlatform, logProviderCall } from "@/lib/providers";
import { detectViralBatch, type ViralThreshold } from "@/lib/viral-detector";
import { getProviderSettings, applySettingsToEnv } from "@/lib/app-settings";
import { sendAllNotifications } from "@/lib/notifications";
import type { Creator, SchedulerJob, SocialPlatform, ScrapedReel } from "@/lib/types";
import { randomUUID } from "crypto";

const ticking = new Set<string>(); // prevent concurrent ticks

const INTERVAL_MAP: Record<string, number> = {
  "1h": 60,
  "2h": 120,
  "4h": 240,
  "6h": 360,
  "12h": 720,
  "24h": 1440,
  "off": 0,
};

function intervalToMinutes(interval: string): number {
  return INTERVAL_MAP[interval] ?? 360;
}

/** Sync scheduler_jobs with current creators + settings. */
export async function syncSchedulerJobs(): Promise<void> {
  const settings = await getProviderSettings();
  const creators = await repo.creators.list();
  const existingJobs = await repo.schedulerJobs.list();
  const existingMap = new Map(existingJobs.map((j) => [`${j.creatorId}:${j.platform}`, j]));

  for (const creator of creators) {
    const platform = (creator.platform || "instagram") as SocialPlatform;
    const platformKey = platform === "youtube_shorts" ? "youtube" : platform;
    const scheduleConfig = settings.schedule[platformKey as keyof typeof settings.schedule];
    if (!scheduleConfig || typeof scheduleConfig !== "object" || !("interval" in scheduleConfig)) continue;

    const intervalMinutes = intervalToMinutes(scheduleConfig.interval);
    const enabled = scheduleConfig.enabled && intervalMinutes > 0;

    const key = `${creator.id}:${platform}`;
    const existing = existingMap.get(key);

    if (existing) {
      // Update interval/enabled only — preserve next_run_at if still valid
      await repo.schedulerJobs.update(existing.id, {
        intervalMinutes,
        enabled,
      });
    } else if (enabled) {
      // Create new job — schedule first run in 1 minute
      const nextRun = new Date(Date.now() + 60_000).toISOString();
      await repo.schedulerJobs.upsert({
        creatorId: creator.id,
        platform,
        intervalMinutes,
        nextRunAt: nextRun,
        status: "idle",
        consecutiveErrors: 0,
        enabled,
      });
    }
  }
}

/** Process a single scheduler job: scrape + detect viral. */
async function processJob(job: SchedulerJob, creator: Creator, threshold: ViralThreshold): Promise<{ videosFound: number; viralDetected: number; error?: string }> {
  await applySettingsToEnv();

  const provider = getProviderForPlatform(creator.platform || "instagram");
  const settings = await getProviderSettings();
  const platformKey = (creator.platform === "youtube_shorts" ? "youtube" : creator.platform || "instagram") as keyof typeof settings.schedule;
  const platformSchedule = settings.schedule[platformKey];
  const maxVideos = (platformSchedule && typeof platformSchedule === "object" && "maxVideos" in platformSchedule)
    ? platformSchedule.maxVideos
    : 10;

  let reels: ScrapedReel[] = [];
  try {
    reels = await logProviderCall(
      provider,
      "scheduler:scrapeReels",
      { username: creator.username, maxVideos, nDays: 7 },
      () => provider.scrapeReels({ username: creator.username, maxVideos, nDays: 7 })
    );
  } catch (err) {
    return {
      videosFound: 0,
      viralDetected: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Detect viral content
  const viral = detectViralBatch(reels, creator, threshold);
  let viralDetected = 0;

  for (const detected of viral) {
    // Skip if alert already exists for this video
    const existingVideo = await repo.videos.list();
    const matchedVideo = existingVideo.find(
      (v) => v.shortcode === detected.reel.shortcode && v.platform === detected.reel.platform
    );

    let videoId: string;
    if (matchedVideo) {
      videoId = matchedVideo.id;
      if (await repo.viralAlerts.existsForVideo(videoId)) continue;
    } else {
      // Save the viral video to videos table so user can analyze it
      const saved = await repo.videos.upsertScraped(detected.reel, {
        provider: provider.name,
        configName: "Auto-Scraped Viral",
        viralityScore: detected.viralityScore,
        rankingReason: detected.reason,
        scoreBreakdown: detected.scoreBreakdown,
        selectedForAnalysis: true,
      });
      if (!saved) continue;
      videoId = saved.id;
    }

    const alert = await repo.viralAlerts.create({
      videoId,
      creatorId: creator.id,
      creatorUsername: creator.username,
      platform: (creator.platform || "instagram") as SocialPlatform,
      viralityScore: detected.viralityScore,
      thresholdUsed: detected.multiplier,
      scoreBreakdown: detected.scoreBreakdown,
    });
    viralDetected += 1;

    // Fire notification (best effort)
    void sendAllNotifications({
      title: `🔥 Viral content from @${creator.username}`,
      message: `${detected.multiplier.toFixed(1)}× baseline · ${detected.reel.views.toLocaleString()} views`,
      url: detected.reel.sourcePostUrl,
      platform: creator.platform,
    }).then(() => repo.viralAlerts.update(alert.id, { notified: true })).catch(() => {});
  }

  return { videosFound: reels.length, viralDetected };
}

/**
 * Main scheduler tick — picks up due jobs and processes them.
 * Called from middleware on every request (debounced).
 */
export async function runSchedulerTick(): Promise<{ processed: number; alerts: number }> {
  if (ticking.has("global")) return { processed: 0, alerts: 0 };
  ticking.add("global");

  try {
    const settings = await getProviderSettings();
    const threshold: ViralThreshold = {
      multiplier: settings.schedule.viralThreshold || 2,
      minViews: settings.schedule.minViews || 10000,
    };

    const dueJobs = await repo.schedulerJobs.listDue();
    if (dueJobs.length === 0) return { processed: 0, alerts: 0 };

    const creators = await repo.creators.list();
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    let totalAlerts = 0;
    let processed = 0;

    // Process jobs sequentially to avoid rate limits
    for (const job of dueJobs.slice(0, 5)) { // max 5 per tick
      const creator = creatorMap.get(job.creatorId);
      if (!creator) continue;

      // Mark running
      await repo.schedulerJobs.update(job.id, { status: "running" });
      const runId = randomUUID();
      const startedAt = new Date().toISOString();

      try {
        const result = await processJob(job, creator, threshold);
        const nextRunAt = new Date(Date.now() + job.intervalMinutes * 60_000).toISOString();
        await repo.schedulerJobs.update(job.id, {
          status: result.error ? "error" : "idle",
          lastRunAt: startedAt,
          nextRunAt,
          lastError: result.error || null,
          consecutiveErrors: result.error ? job.consecutiveErrors + 1 : 0,
        });
        totalAlerts += result.viralDetected;
        processed += 1;

        // Save run history (best effort)
        // Note: scheduler_runs table exists but we don't insert via repo to keep it simple
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const nextRunAt = new Date(Date.now() + job.intervalMinutes * 60_000).toISOString();
        await repo.schedulerJobs.update(job.id, {
          status: "error",
          lastRunAt: startedAt,
          nextRunAt,
          lastError: message,
          consecutiveErrors: job.consecutiveErrors + 1,
        });
      }
    }

    return { processed, alerts: totalAlerts };
  } finally {
    ticking.delete("global");
  }
}

/** Get scheduler status summary for dashboard. */
export async function getSchedulerStatus() {
  const jobs = await repo.schedulerJobs.list();
  const enabled = jobs.filter((j) => j.enabled);
  const due = jobs.filter((j) => j.enabled && j.nextRunAt <= new Date().toISOString());
  const erroring = jobs.filter((j) => j.consecutiveErrors >= 3);
  const unseenAlerts = await repo.viralAlerts.countUnseen();
  return {
    totalJobs: jobs.length,
    enabledJobs: enabled.length,
    dueJobs: due.length,
    erroringJobs: erroring.length,
    unseenAlerts,
  };
}
