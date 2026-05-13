import { NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import { getProviderSettings } from "@/lib/app-settings";

export async function GET() {
  try {
    const [videos, scripts, creators, configs, runs, alerts] = await Promise.all([
      repo.videos.list(),
      repo.scripts.list(),
      repo.creators.list(),
      repo.configs.list(),
      repo.runs.list(),
      repo.viralAlerts.list({ dismissed: false }),
    ]);
    const settings = await getProviderSettings();

    // Stats
    const stats = {
      totalVideos: videos.length,
      analyzedVideos: videos.filter((v) => v.analysisStatus === "ok" || v.analysisStatus === "fallback").length,
      totalScripts: scripts.length,
      totalCreators: creators.length,
      totalConfigs: configs.length,
      viralAlerts: alerts.filter((a) => !a.seen).length,
      lastRun: runs[0]
        ? { id: runs[0].id, status: runs[0].status, configName: runs[0].configName, completedAt: runs[0].completedAt }
        : null,
    };

    // Provider health summary
    const providerHealth = {
      gemini: Boolean(settings.ai.analysis.geminiKey),
      apify: Boolean(settings.scraping.instagram.apifyToken || settings.scraping.tiktok.apifyToken),
      youtubeApi: Boolean(settings.scraping.youtube.apiKey),
      claude: Boolean(settings.ai.scriptGen.claudeKey),
      fal: Boolean(settings.video.falKey),
      telegram: settings.notifications.telegram.enabled,
    };

    // Quick actions / warnings
    const warnings: { type: "error" | "warning" | "info"; message: string; action?: { label: string; href: string } }[] = [];

    if (!providerHealth.gemini) {
      warnings.push({
        type: "error",
        message: "Gemini API key not configured. Video analysis will not work.",
        action: { label: "Configure", href: "/settings" },
      });
    }
    if (creators.length === 0) {
      warnings.push({
        type: "warning",
        message: "No creators added yet. Add competitors to start tracking viral content.",
        action: { label: "Add Creator", href: "/creators" },
      });
    }
    if (configs.length === 0) {
      warnings.push({
        type: "warning",
        message: "No pipeline configs created. Create a config to run the pipeline.",
        action: { label: "Create Config", href: "/configs" },
      });
    }

    // Configs with no matching creators
    for (const config of configs) {
      const matching = creators.filter(
        (c) => c.category.toLowerCase() === config.creatorsCategory.toLowerCase()
      );
      if (matching.length === 0) {
        warnings.push({
          type: "warning",
          message: `Config "${config.configName}" has no creators in category "${config.creatorsCategory}".`,
          action: { label: "Fix", href: "/creators" },
        });
      }
    }

    // Recent activity (last 10 events from videos + scripts + runs)
    const activity: { type: string; title: string; subtitle: string; timestamp: string }[] = [];
    for (const v of videos.slice(0, 5)) {
      activity.push({
        type: "video",
        title: `New video from @${v.creator}`,
        subtitle: `${v.views.toLocaleString()} views · ${v.platform || "instagram"}`,
        timestamp: v.dateAdded,
      });
    }
    for (const s of scripts.slice(0, 5)) {
      activity.push({
        type: "script",
        title: `Script generated: "${s.title}"`,
        subtitle: `Based on @${s.videoCreator}`,
        timestamp: s.dateGenerated,
      });
    }
    for (const r of runs.slice(0, 5)) {
      activity.push({
        type: "run",
        title: `Pipeline ${r.status}: ${r.configName}`,
        subtitle: `Provider: ${r.provider}`,
        timestamp: r.completedAt || r.startedAt || r.createdAt,
      });
    }
    activity.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

    // Top viral videos this week
    const oneWeekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const topViral = [...videos]
      .filter((v) => (v.dateAdded || "") >= oneWeekAgo && v.views > 0)
      .sort((a, b) => (b.viralityScore || 0) - (a.viralityScore || 0))
      .slice(0, 6);

    return NextResponse.json({
      stats,
      providerHealth,
      warnings,
      recentActivity: activity.slice(0, 10),
      topViral,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
