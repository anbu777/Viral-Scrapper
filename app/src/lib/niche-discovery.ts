import { repo, normalizeUsername } from "@/db/repositories";
import type { SocialPlatform, Creator } from "@/lib/types";
import { getProviderSettings } from "@/lib/app-settings";

export interface DiscoveredCreator {
  username: string;
  platform: SocialPlatform;
  followers: number;
  avgViews: number;
  viralityScore: number;
  sampleVideos: Array<{ link: string; views: number; thumbnail: string }>;
  alreadyTracked: boolean;
  source: "videos" | "external";
}

/**
 * Discovers creators relevant to a keyword.
 *
 * Strategy:
 * 1. Search local videos table for creators whose captions or analysis match keyword
 * 2. Rank them by virality score and average views
 * 3. Mark which ones are already tracked
 * 4. (Future) For external discovery, integrate Apify search actors
 */
export async function discoverCreators(opts: {
  keyword: string;
  platform?: SocialPlatform | "all";
  maxCreators?: number;
}): Promise<DiscoveredCreator[]> {
  const keyword = opts.keyword.trim().toLowerCase();
  if (!keyword) return [];

  const platformFilter = opts.platform || "all";
  const maxCreators = opts.maxCreators ?? 20;

  // 1. Search videos table for keyword matches
  const allVideos = await repo.videos.list();
  const allCreators = await repo.creators.list();

  // Build a map of normalized username -> creator info
  const trackedSet = new Set(
    allCreators.flatMap((c) => {
      const names = [c.username, ...(c.aliases || [])];
      return names.map((n) => `${c.platform}::${normalizeUsername(n)}`);
    })
  );

  // Filter videos matching keyword in caption or analysis
  const matches = allVideos.filter((v) => {
    if (platformFilter !== "all" && (v.platform || "instagram") !== platformFilter) return false;
    const haystack = [
      v.caption || "",
      v.creator || "",
      v.analysisJson?.summary || "",
      v.analysisJson?.formatPattern || "",
      v.analysisJson?.audience || "",
      (v.analysisJson?.viralMechanics || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });

  // Aggregate by creator + platform
  type Agg = {
    username: string;
    platform: SocialPlatform;
    totalViews: number;
    videoCount: number;
    viralCount: number;
    bestVirality: number;
    sampleVideos: Array<{ link: string; views: number; thumbnail: string }>;
  };
  const aggMap: Record<string, Agg> = {};
  for (const v of matches) {
    const platform = (v.platform || "instagram") as SocialPlatform;
    const key = `${platform}::${v.creator}`;
    if (!aggMap[key]) {
      aggMap[key] = {
        username: v.creator,
        platform,
        totalViews: 0,
        videoCount: 0,
        viralCount: 0,
        bestVirality: 0,
        sampleVideos: [],
      };
    }
    const agg = aggMap[key];
    agg.totalViews += v.views || 0;
    agg.videoCount += 1;
    if ((v.viralityScore || 0) >= 60) agg.viralCount += 1;
    if ((v.viralityScore || 0) > agg.bestVirality) agg.bestVirality = v.viralityScore || 0;
    if (agg.sampleVideos.length < 3) {
      agg.sampleVideos.push({
        link: v.link,
        views: v.views || 0,
        thumbnail: v.thumbnail || "",
      });
    }
  }

  // Resolve creator stats and tracked status
  const resolved: DiscoveredCreator[] = Object.values(aggMap).map((a) => {
    const trackedKey = `${a.platform}::${normalizeUsername(a.username)}`;
    const trackedCreator: Creator | undefined = allCreators.find((c) => {
      const names = [c.username, ...(c.aliases || [])];
      return c.platform === a.platform && names.some((n) => normalizeUsername(n) === normalizeUsername(a.username));
    });
    return {
      username: a.username,
      platform: a.platform,
      followers: trackedCreator?.followers || 0,
      avgViews: a.videoCount > 0 ? Math.round(a.totalViews / a.videoCount) : 0,
      viralityScore: a.bestVirality,
      sampleVideos: a.sampleVideos,
      alreadyTracked: trackedSet.has(trackedKey),
      source: "videos",
    };
  });

  // Rank: viral count * 1000 + avg views
  resolved.sort(
    (a, b) =>
      (b.viralityScore || 0) * 1000 + b.avgViews - ((a.viralityScore || 0) * 1000 + a.avgViews)
  );

  return resolved.slice(0, maxCreators);
}

/**
 * Quickly tells if external discovery (Apify search actors) is available.
 * For now we just check if APIFY_API_TOKEN is configured.
 */
export async function isExternalDiscoveryAvailable(): Promise<boolean> {
  const settings = await getProviderSettings();
  return Boolean(settings.scraping.instagram.apifyToken || settings.scraping.tiktok.apifyToken);
}
