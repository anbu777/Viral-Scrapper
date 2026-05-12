import type { Creator, ScrapedReel } from "@/lib/types";

export interface ViralityScore {
  score: number;
  reason: string;
  breakdown: Record<string, number | string>;
}

function daysSince(postedAt: string) {
  if (!postedAt) return 30;
  const time = new Date(postedAt).getTime();
  if (Number.isNaN(time)) return 30;
  return Math.max(1, (Date.now() - time) / 86_400_000);
}

export function calculateViralityScore(reel: ScrapedReel, creator?: Creator): ViralityScore {
  const followers = Math.max(creator?.followers || 0, 1);
  const viewsPerFollower = reel.views / followers;
  const ageDays = daysSince(reel.postedAt);
  const velocity = reel.views / ageDays;
  const likeRate = reel.views > 0 ? reel.likes / reel.views : 0;
  const commentRate = reel.views > 0 ? reel.comments / reel.views : 0;
  const baseline = Math.max(creator?.avgViews30d || 0, 1);
  const outlier = reel.views / baseline;
  const duration = reel.durationSeconds || 30;
  const durationBoost = duration <= 15 ? 1.15 : duration <= 45 ? 1 : 0.9;
  const recencyBoost = ageDays <= 7 ? 1.2 : ageDays <= 30 ? 1 : 0.85;

  const score =
    (Math.log10(reel.views + 1) * 20 +
      Math.min(viewsPerFollower, 5) * 20 +
      Math.log10(velocity + 1) * 10 +
      Math.min(likeRate * 100, 10) * 2 +
      Math.min(commentRate * 100, 5) * 4 +
      Math.min(outlier, 10) * 5) *
    durationBoost *
    recencyBoost;

  const rounded = Math.round(score * 100) / 100;
  return {
    score: rounded,
    reason: `Virality ${rounded}: ${Math.round(velocity).toLocaleString()} views/day, ${outlier.toFixed(1)}x creator baseline.`,
    breakdown: {
      views: reel.views,
      viewsPerFollower: Number(viewsPerFollower.toFixed(4)),
      velocity: Math.round(velocity),
      likeRate: Number(likeRate.toFixed(4)),
      commentRate: Number(commentRate.toFixed(4)),
      outlier: Number(outlier.toFixed(2)),
      durationBoost,
      recencyBoost,
    },
  };
}
