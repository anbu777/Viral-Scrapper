export interface ApifyReel {
  videoUrl: string;
  url: string;
  videoPlayCount: number;
  likesCount: number;
  commentsCount: number;
  ownerUsername: string;
  images: string[];
  timestamp: string;
  videoDuration?: number;   // Duration in seconds (returned by Apify Instagram scraper)
}

interface ApifyProfileResult {
  profilePicUrl: string;
  followersCount: number;
}

export interface CreatorStats {
  profilePicUrl: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
}

function getToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN not set");
  return token;
}

export async function scrapeReels(
  username: string,
  maxVideos: number,
  nDays: number
): Promise<ApifyReel[]> {
  const token = getToken();

  const sinceDate = new Date(Date.now() - nDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Retry up to 2 times for transient network failures
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&memory=256&timeout=120`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addParentData: false,
            directUrls: [`https://www.instagram.com/${username}/reels/`],
            enhanceUserSearchWithFacebookPage: false,
            isUserReelFeedURL: true,
            isUserTaggedFeedURL: false,
            onlyPostsNewerThan: sinceDate,
            resultsLimit: maxVideos,
            resultsType: "posts",
          }),
          signal: AbortSignal.timeout(180_000), // 3 minute client-side timeout
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Apify error ${response.status}: ${text.slice(0, 300)}`);
      }

      const data = await response.json();
      return data as ApifyReel[];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      // Only retry on network/timeout errors, not on 4xx client errors
      if (/fetch failed|timeout|econnreset|econnrefused|socket|abort/i.test(msg)) {
        console.warn(`[apify] scrapeReels attempt ${attempt + 1} failed for @${username}: ${lastError.message}. Retrying...`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error(`Apify scrapeReels failed for @${username} after 3 attempts`);
}

export async function refreshVideoUrl(postUrl: string): Promise<string | null> {
  const token = getToken();
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&memory=256&timeout=60`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [postUrl],
          resultsType: "posts",
          resultsLimit: 1,
        }),
        signal: AbortSignal.timeout(90_000),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Apify refresh error ${response.status}: ${text.slice(0, 300)}`);
    }
    const data = await response.json() as ApifyReel[];
    return data[0]?.videoUrl || null;
  } catch (err) {
    console.warn(`[apify] refreshVideoUrl failed for ${postUrl}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function scrapeCreatorStats(username: string): Promise<CreatorStats> {
  const token = getToken();

  // 1. Get profile info (details mode)
  const profileRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&memory=256&timeout=60`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: "details",
        resultsLimit: 1,
      }),
      signal: AbortSignal.timeout(90_000),
    }
  );

  if (!profileRes.ok) {
    const text = await profileRes.text();
    throw new Error(`Apify profile error ${profileRes.status}: ${text.slice(0, 300)}`);
  }

  const profileData = await profileRes.json() as ApifyProfileResult[];
  const profile = profileData[0] || {};
  const profilePicUrl = profile.profilePicUrl || "";
  const followers = profile.followersCount || 0;

  // 2. Get recent posts (last 30 days) to compute activity metrics
  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const postsRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&memory=256&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${username}/reels/`],
        resultsType: "posts",
        resultsLimit: 100,
        onlyPostsNewerThan: sinceDate,
        addParentData: false,
        isUserReelFeedURL: true,
      }),
      signal: AbortSignal.timeout(180_000),
    }
  );

  if (!postsRes.ok) {
    const text = await postsRes.text();
    throw new Error(`Apify posts error ${postsRes.status}: ${text.slice(0, 300)}`);
  }

  const posts = await postsRes.json() as ApifyReel[];

  // Filter to only video posts within 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentReels = posts.filter((p) => {
    const isRecent = p.timestamp && new Date(p.timestamp) >= cutoff;
    const looksLikeReel = Boolean(p.videoUrl) || (p.videoPlayCount || 0) > 0 || /\/reel\//i.test(p.url || "");
    return isRecent && looksLikeReel;
  });

  const reelsCount30d = recentReels.length;
  const avgViews30d = reelsCount30d > 0
    ? Math.round(recentReels.reduce((sum, r) => sum + (r.videoPlayCount || 0), 0) / reelsCount30d)
    : 0;

  return { profilePicUrl, followers, reelsCount30d, avgViews30d };
}
