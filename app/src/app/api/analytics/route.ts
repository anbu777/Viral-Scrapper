import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import type { Video, SocialPlatform } from "@/lib/types";

type Period = "7d" | "30d" | "90d";

function periodToDays(period: Period): number {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  return 90;
}

function bucketByDate(videos: Video[]): Record<string, { date: string; totalViews: number; instagram: number; tiktok: number; youtube_shorts: number; count: number }> {
  const map: Record<string, { date: string; totalViews: number; instagram: number; tiktok: number; youtube_shorts: number; count: number }> = {};
  for (const v of videos) {
    const date = (v.dateAdded || v.datePosted || "").slice(0, 10);
    if (!date) continue;
    if (!map[date]) {
      map[date] = { date, totalViews: 0, instagram: 0, tiktok: 0, youtube_shorts: 0, count: 0 };
    }
    map[date].totalViews += v.views || 0;
    map[date].count += 1;
    const platform = (v.platform || "instagram") as SocialPlatform;
    if (platform === "tiktok") map[date].tiktok += v.views || 0;
    else if (platform === "youtube_shorts") map[date].youtube_shorts += v.views || 0;
    else map[date].instagram += v.views || 0;
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const period = (url.searchParams.get("period") || "30d") as Period;
    const days = periodToDays(period);
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    const allVideos = await repo.videos.list();
    const videos = allVideos.filter((v) => {
      const d = (v.dateAdded || v.datePosted || "").slice(0, 10);
      return d >= cutoff;
    });

    // Views over time
    const buckets = bucketByDate(videos);
    const viewsOverTime = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));

    // Top creators by avg views
    const creatorMap: Record<string, { username: string; totalViews: number; videoCount: number; viralCount: number }> = {};
    for (const v of videos) {
      const u = v.creator || "unknown";
      if (!creatorMap[u]) creatorMap[u] = { username: u, totalViews: 0, videoCount: 0, viralCount: 0 };
      creatorMap[u].totalViews += v.views || 0;
      creatorMap[u].videoCount += 1;
      if ((v.viralityScore || 0) >= 70) creatorMap[u].viralCount += 1;
    }
    const topCreators = Object.values(creatorMap)
      .map((c) => ({
        username: c.username,
        avgViews: c.videoCount > 0 ? Math.round(c.totalViews / c.videoCount) : 0,
        videoCount: c.videoCount,
        viralCount: c.viralCount,
      }))
      .sort((a, b) => b.avgViews - a.avgViews)
      .slice(0, 10);

    // Top formats (from analysisJson.formatPattern)
    const formatMap: Record<string, { format: string; count: number; totalViews: number }> = {};
    for (const v of videos) {
      const fmt = (v.analysisJson?.formatPattern || "Unknown").trim() || "Unknown";
      if (!formatMap[fmt]) formatMap[fmt] = { format: fmt, count: 0, totalViews: 0 };
      formatMap[fmt].count += 1;
      formatMap[fmt].totalViews += v.views || 0;
    }
    const topFormats = Object.values(formatMap)
      .map((f) => ({ format: f.format, count: f.count, avgViews: f.count > 0 ? Math.round(f.totalViews / f.count) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Posting heatmap (hour x dayOfWeek)
    const heatmap: Array<{ hour: number; dayOfWeek: number; engagement: number; count: number }> = [];
    const hmMap: Record<string, { hour: number; dayOfWeek: number; engagement: number; count: number }> = {};
    for (const v of videos) {
      const dt = v.datePosted || v.dateAdded;
      if (!dt) continue;
      const d = new Date(dt);
      if (Number.isNaN(d.getTime())) continue;
      const hour = d.getUTCHours();
      const dow = d.getUTCDay();
      const key = `${dow}-${hour}`;
      if (!hmMap[key]) hmMap[key] = { hour, dayOfWeek: dow, engagement: 0, count: 0 };
      hmMap[key].engagement += (v.likes || 0) + (v.comments || 0) * 2;
      hmMap[key].count += 1;
    }
    for (const item of Object.values(hmMap)) {
      heatmap.push({
        hour: item.hour,
        dayOfWeek: item.dayOfWeek,
        engagement: item.count > 0 ? Math.round(item.engagement / item.count) : 0,
        count: item.count,
      });
    }

    // Viral patterns
    const viralVideos = videos.filter((v) => (v.viralityScore || 0) >= 60);
    const totalDuration = viralVideos.reduce((sum, v) => sum + (v.duration || 0), 0);
    const avgDuration = viralVideos.length > 0 ? Math.round(totalDuration / viralVideos.length) : 0;
    const topHooks: string[] = viralVideos
      .map((v) => v.analysisJson?.hook || "")
      .filter((h) => h && h.length > 5)
      .slice(0, 5);
    const topFormatPatterns = Object.values(formatMap)
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 3)
      .map((f) => f.format);

    // Platform distribution
    const platformDist = { instagram: 0, tiktok: 0, youtube_shorts: 0 };
    for (const v of videos) {
      const p = (v.platform || "instagram") as keyof typeof platformDist;
      if (p in platformDist) platformDist[p] += 1;
    }

    // Key metrics summary
    const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const viralCount = videos.filter((v) => (v.viralityScore || 0) >= 70).length;
    const avgVirality = videos.length > 0
      ? Math.round(videos.reduce((sum, v) => sum + (v.viralityScore || 0), 0) / videos.length)
      : 0;
    const mostActive = (() => {
      const counts = { instagram: platformDist.instagram, tiktok: platformDist.tiktok, youtube_shorts: platformDist.youtube_shorts };
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      const total = videos.length || 1;
      return top ? { platform: top[0], pct: Math.round((top[1] / total) * 100) } : { platform: "instagram", pct: 0 };
    })();

    return NextResponse.json({
      period,
      summary: {
        totalViews,
        viralVideos: viralCount,
        avgVirality,
        mostActivePlatform: mostActive.platform,
        mostActivePct: mostActive.pct,
        videoCount: videos.length,
      },
      viewsOverTime,
      topCreators,
      topFormats,
      postingHeatmap: heatmap,
      viralPatterns: {
        avgDuration,
        topHooks,
        topFormats: topFormatPatterns,
      },
      platformDistribution: platformDist,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
