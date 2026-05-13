/**
 * Viral content detection logic.
 *
 * A video is considered viral when:
 *   1. Views exceed minimum threshold (e.g. 10k)
 *   2. Views are N× higher than the creator's 30-day baseline
 *   3. Virality score exceeds configured threshold
 *
 * Thresholds are configured per-installation in app_settings.
 */

import type { Creator, ScrapedReel, ViralAlert } from "@/lib/types";
import { calculateViralityScore } from "@/lib/ranking";

export interface ViralThreshold {
  multiplier: number;
  minViews: number;
  minScore?: number;
}

export interface DetectedViralVideo {
  reel: ScrapedReel;
  viralityScore: number;
  multiplier: number;
  scoreBreakdown: Record<string, number | string>;
  reason: string;
}

/**
 * Determine if a single reel is "viral" relative to its creator's baseline.
 */
export function detectViral(
  reel: ScrapedReel,
  creator: Creator,
  threshold: ViralThreshold
): DetectedViralVideo | null {
  // Skip if below absolute view minimum
  if (reel.views < threshold.minViews) return null;

  // Calculate virality
  const virality = calculateViralityScore(reel, creator);

  // Compare to creator baseline
  const baseline = Math.max(creator.avgViews30d || 0, 1);
  const multiplier = reel.views / baseline;

  // Need to exceed multiplier threshold
  if (multiplier < threshold.multiplier) return null;

  // Optional minimum score threshold
  if (threshold.minScore && virality.score < threshold.minScore) return null;

  return {
    reel,
    viralityScore: virality.score,
    multiplier: Number(multiplier.toFixed(2)),
    scoreBreakdown: virality.breakdown,
    reason: `${multiplier.toFixed(1)}× creator baseline (${reel.views.toLocaleString()} vs ${baseline.toLocaleString()} avg)`,
  };
}

/**
 * Filter a list of reels to only those that are viral.
 */
export function detectViralBatch(
  reels: ScrapedReel[],
  creator: Creator,
  threshold: ViralThreshold
): DetectedViralVideo[] {
  return reels
    .map((reel) => detectViral(reel, creator, threshold))
    .filter((d): d is DetectedViralVideo => d !== null)
    .sort((a, b) => b.viralityScore - a.viralityScore);
}

/**
 * Format alert message for human-readable display.
 */
export function formatAlertMessage(alert: ViralAlert): string {
  return `🔥 @${alert.creatorUsername} on ${alert.platform} — ${alert.thresholdUsed.toFixed(1)}× baseline (score: ${alert.viralityScore.toFixed(0)})`;
}
