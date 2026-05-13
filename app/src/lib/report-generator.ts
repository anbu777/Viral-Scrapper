import { repo } from "@/db/repositories";
import type { Video } from "@/lib/types";

export interface WeeklyReport {
  configName: string;
  period: { from: string; to: string };
  stats: {
    totalVideos: number;
    totalViews: number;
    avgVirality: number;
    viralCount: number;
    topPlatform: string;
  };
  topVideos: Array<{
    id: string;
    creator: string;
    platform: string;
    views: number;
    likes: number;
    viralityScore: number;
    link: string;
    caption: string;
    formatPattern: string;
  }>;
  viralPatterns: {
    formats: string[];
    hooks: string[];
    avgDurationSeconds: number;
    bestPostingHours: string[];
  };
  topCreators: Array<{ username: string; totalViews: number; videoCount: number }>;
  recommendations: string[];
  generatedAt: string;
}

function inRange(v: Video, fromDate: string, toDate: string): boolean {
  const date = (v.dateAdded || v.datePosted || "").slice(0, 10);
  return date >= fromDate && date <= toDate;
}

export async function generateWeeklyReport(opts: {
  configName?: string;
  daysBack?: number;
}): Promise<WeeklyReport> {
  const daysBack = opts.daysBack ?? 7;
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);

  const allVideos = await repo.videos.list();
  const filtered = allVideos.filter((v) => {
    if (!inRange(v, fromDate, toDate)) return false;
    if (opts.configName && v.configName !== opts.configName) return false;
    return true;
  });

  const totalViews = filtered.reduce((sum, v) => sum + (v.views || 0), 0);
  const avgVirality = filtered.length > 0
    ? Math.round(filtered.reduce((sum, v) => sum + (v.viralityScore || 0), 0) / filtered.length)
    : 0;
  const viralCount = filtered.filter((v) => (v.viralityScore || 0) >= 70).length;

  // Top platform
  const platformCounts: Record<string, number> = {};
  for (const v of filtered) {
    const p = v.platform || "instagram";
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  }
  const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "instagram";

  // Top videos by virality + views
  const topVideos = [...filtered]
    .sort((a, b) => {
      const scoreA = (a.viralityScore || 0) * 1000 + (a.views || 0);
      const scoreB = (b.viralityScore || 0) * 1000 + (b.views || 0);
      return scoreB - scoreA;
    })
    .slice(0, 10)
    .map((v) => ({
      id: v.id,
      creator: v.creator,
      platform: v.platform || "instagram",
      views: v.views || 0,
      likes: v.likes || 0,
      viralityScore: v.viralityScore || 0,
      link: v.link,
      caption: (v.caption || "").slice(0, 200),
      formatPattern: v.analysisJson?.formatPattern || "Unknown",
    }));

  // Format patterns
  const formatCounts: Record<string, { count: number; views: number }> = {};
  for (const v of filtered) {
    const fmt = v.analysisJson?.formatPattern || "Unknown";
    if (!formatCounts[fmt]) formatCounts[fmt] = { count: 0, views: 0 };
    formatCounts[fmt].count += 1;
    formatCounts[fmt].views += v.views || 0;
  }
  const topFormats = Object.entries(formatCounts)
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 5)
    .map(([fmt]) => fmt);

  // Top hooks (from viral videos only)
  const viralVideos = filtered.filter((v) => (v.viralityScore || 0) >= 60);
  const topHooks = viralVideos
    .map((v) => v.analysisJson?.hook || "")
    .filter((h) => h && h.length > 5)
    .slice(0, 5);

  // Avg duration of viral videos
  const viralWithDuration = viralVideos.filter((v) => v.duration && v.duration > 0);
  const avgDuration = viralWithDuration.length > 0
    ? Math.round(viralWithDuration.reduce((s, v) => s + (v.duration || 0), 0) / viralWithDuration.length)
    : 0;

  // Best posting hours
  const hourEng: Record<number, { eng: number; count: number }> = {};
  for (const v of filtered) {
    const dt = v.datePosted || v.dateAdded;
    if (!dt) continue;
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) continue;
    const h = d.getUTCHours();
    if (!hourEng[h]) hourEng[h] = { eng: 0, count: 0 };
    hourEng[h].eng += (v.likes || 0) + (v.comments || 0) * 2;
    hourEng[h].count += 1;
  }
  const bestHours = Object.entries(hourEng)
    .map(([h, d]) => ({ hour: parseInt(h, 10), avg: d.count > 0 ? d.eng / d.count : 0 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map((h) => `${h.hour.toString().padStart(2, "0")}:00 UTC`);

  // Top creators
  const creatorMap: Record<string, { totalViews: number; videoCount: number }> = {};
  for (const v of filtered) {
    const u = v.creator || "unknown";
    if (!creatorMap[u]) creatorMap[u] = { totalViews: 0, videoCount: 0 };
    creatorMap[u].totalViews += v.views || 0;
    creatorMap[u].videoCount += 1;
  }
  const topCreators = Object.entries(creatorMap)
    .sort((a, b) => b[1].totalViews - a[1].totalViews)
    .slice(0, 5)
    .map(([username, d]) => ({ username, ...d }));

  // Recommendations
  const recommendations: string[] = [];
  if (topFormats.length > 0) {
    recommendations.push(`Format konten "${topFormats[0]}" mendominasi viral content. Coba adaptasi format ini ke niche Anda.`);
  }
  if (avgDuration > 0) {
    recommendations.push(`Durasi optimal viral video periode ini: ~${avgDuration} detik. Sesuaikan target durasi script Anda.`);
  }
  if (bestHours.length > 0) {
    recommendations.push(`Posting time terbaik: ${bestHours.join(", ")} (UTC). Adjust ke timezone audience target Anda.`);
  }
  if (topCreators.length > 0) {
    const tc = topCreators[0];
    recommendations.push(`@${tc.username} dominasi minggu ini dengan ${tc.totalViews.toLocaleString()} total views dari ${tc.videoCount} video.`);
  }
  if (viralCount === 0) {
    recommendations.push("Belum ada konten viral terdeteksi. Pertimbangkan menambahkan kreator dengan engagement lebih tinggi atau menurunkan threshold viral di Settings.");
  }

  return {
    configName: opts.configName || "all",
    period: { from: fromDate, to: toDate },
    stats: {
      totalVideos: filtered.length,
      totalViews,
      avgVirality,
      viralCount,
      topPlatform,
    },
    topVideos,
    viralPatterns: {
      formats: topFormats,
      hooks: topHooks,
      avgDurationSeconds: avgDuration,
      bestPostingHours: bestHours,
    },
    topCreators,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

export function exportReportAsMarkdown(report: WeeklyReport): string {
  const lines: string[] = [];
  lines.push(`# Intelligence Report — ${report.configName}`);
  lines.push("");
  lines.push(`**Period**: ${report.period.from} → ${report.period.to}`);
  lines.push(`**Generated**: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Summary Stats");
  lines.push("");
  lines.push(`- Total videos analyzed: **${report.stats.totalVideos}**`);
  lines.push(`- Total views tracked: **${report.stats.totalViews.toLocaleString()}**`);
  lines.push(`- Average virality score: **${report.stats.avgVirality}**`);
  lines.push(`- Viral videos (score ≥70): **${report.stats.viralCount}**`);
  lines.push(`- Most active platform: **${report.stats.topPlatform}**`);
  lines.push("");
  lines.push("## Top Performing Videos");
  lines.push("");
  for (const v of report.topVideos) {
    lines.push(`- **@${v.creator}** (${v.platform}) — ${v.views.toLocaleString()} views, score ${v.viralityScore.toFixed(0)}`);
    if (v.caption) lines.push(`  > ${v.caption.slice(0, 120)}${v.caption.length > 120 ? "…" : ""}`);
    lines.push(`  [Watch](${v.link}) · Format: ${v.formatPattern}`);
  }
  lines.push("");
  lines.push("## Viral Patterns");
  lines.push("");
  if (report.viralPatterns.formats.length > 0) {
    lines.push(`**Top formats**: ${report.viralPatterns.formats.join(", ")}`);
  }
  if (report.viralPatterns.avgDurationSeconds > 0) {
    lines.push(`**Avg viral duration**: ${report.viralPatterns.avgDurationSeconds}s`);
  }
  if (report.viralPatterns.bestPostingHours.length > 0) {
    lines.push(`**Best posting times**: ${report.viralPatterns.bestPostingHours.join(", ")}`);
  }
  if (report.viralPatterns.hooks.length > 0) {
    lines.push("");
    lines.push("**Top viral hooks**:");
    for (const h of report.viralPatterns.hooks) {
      lines.push(`- "${h}"`);
    }
  }
  lines.push("");
  lines.push("## Top Creators");
  lines.push("");
  for (const c of report.topCreators) {
    lines.push(`- **@${c.username}** — ${c.totalViews.toLocaleString()} views from ${c.videoCount} videos`);
  }
  lines.push("");
  lines.push("## Recommendations");
  lines.push("");
  for (const r of report.recommendations) {
    lines.push(`- ${r}`);
  }
  lines.push("");
  lines.push("---");
  lines.push(`_Generated by Virality System on ${report.generatedAt}_`);
  return lines.join("\n");
}
