/**
 * Creator grouping logic — detects when the same creator exists across multiple
 * platforms and suggests grouping them together.
 *
 * Used by Creators page to display creators as folders when they share identity.
 */

import type { Creator } from "@/lib/types";

/** Normalize a username for comparison — strip @, dots, underscores, hyphens, lowercase. */
export function normalizeUsername(username: string): string {
  return username
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[._\-]/g, "");
}

/** Check if two creators are likely the same person across platforms. */
export function areLikelySameCreator(a: Creator, b: Creator): boolean {
  if (a.id === b.id) return false; // same record, not a match
  if (a.platform === b.platform) return false; // same platform, different accounts

  const aNames = [a.username, ...(a.aliases || [])].map(normalizeUsername);
  const bNames = [b.username, ...(b.aliases || [])].map(normalizeUsername);

  // Direct match
  for (const aName of aNames) {
    if (bNames.includes(aName)) return true;
  }

  // Substring match (e.g. "timothyronald" vs "timothyronaldd")
  for (const aName of aNames) {
    for (const bName of bNames) {
      if (aName.length >= 5 && bName.length >= 5) {
        if (aName.includes(bName) || bName.includes(aName)) return true;
      }
    }
  }

  return false;
}

/**
 * Auto-detect groups of creators that should be linked together.
 * Returns suggested groupings — UI can prompt user to confirm.
 */
export function suggestGroupings(creators: Creator[]): Creator[][] {
  const ungrouped = creators.filter((c) => !c.groupId);
  const groups: Creator[][] = [];
  const visited = new Set<string>();

  for (const creator of ungrouped) {
    if (visited.has(creator.id)) continue;
    const matches = ungrouped.filter(
      (other) => !visited.has(other.id) && areLikelySameCreator(creator, other)
    );
    if (matches.length > 0) {
      const group = [creator, ...matches];
      group.forEach((c) => visited.add(c.id));
      groups.push(group);
    }
  }

  return groups;
}

/** Aggregate stats across all creators in a group. */
export function aggregateGroupStats(creators: Creator[]): {
  totalFollowers: number;
  totalReels30d: number;
  avgViews30d: number;
  platforms: string[];
} {
  const totalFollowers = creators.reduce((sum, c) => sum + c.followers, 0);
  const totalReels30d = creators.reduce((sum, c) => sum + c.reelsCount30d, 0);
  const validForAvg = creators.filter((c) => c.avgViews30d > 0);
  const avgViews30d = validForAvg.length
    ? Math.round(validForAvg.reduce((sum, c) => sum + c.avgViews30d, 0) / validForAvg.length)
    : 0;
  const platforms = [...new Set(creators.map((c) => c.platform))];
  return { totalFollowers, totalReels30d, avgViews30d, platforms };
}
