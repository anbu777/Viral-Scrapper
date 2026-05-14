import { refreshVideoUrl, scrapeCreatorStats, scrapeReels } from "@/lib/apify";
import type { InstagramScraperProvider, ScrapeReelsInput } from "./instagram";
import { downloadByUrl, extractShortcode } from "./instagram";

export const apifyProvider: InstagramScraperProvider = {
  name: "apify",
  async scrapeCreatorStats(username) {
    return scrapeCreatorStats(username);
  },
  async scrapeReels(input: ScrapeReelsInput) {
    const reels = await scrapeReels(input.username, input.maxVideos, input.nDays);
    return reels
      .filter((reel) => {
        if (!reel.url) return false;
        // Skip profile/feed page URLs — only keep individual post/reel URLs
        // Valid: /p/SHORTCODE/, /reel/SHORTCODE/
        // Invalid: /user/reels/, /user/, /user/tagged/
        const isIndividualPost = /\/(p|reel|reels)\/[A-Za-z0-9_-]{5,}/.test(reel.url);
        const isProfilePage = /\/(reels|tagged|channel|videos)\/?$/.test(reel.url);
        return isIndividualPost || (!isProfilePage && reel.url.includes("/p/") || reel.url.includes("/reel/"));
      })
      .map((reel) => ({
        platform: "instagram" as const,
        sourcePostUrl: reel.url,
        shortcode: extractShortcode(reel.url),
        creatorUsername: reel.ownerUsername || input.username,
        caption: "",
        thumbnailUrl: reel.images?.[0] || "",
        videoFileUrl: reel.videoUrl || null,
        postedAt: reel.timestamp || "",
        views: reel.videoPlayCount || 0,
        likes: reel.likesCount || 0,
        comments: reel.commentsCount || 0,
        durationSeconds: reel.videoDuration,
        rawProviderPayload: reel,
      }));
  },
  refreshVideoUrl,
  async downloadVideo(input) {
    const videoFileUrl = input.videoFileUrl || (input.postUrl ? await refreshVideoUrl(input.postUrl) : null);
    return downloadByUrl(videoFileUrl);
  },
  async validateSession() {
    return {
      status: process.env.APIFY_API_TOKEN ? "ok" : "login_required",
      message: process.env.APIFY_API_TOKEN ? "APIFY_API_TOKEN is configured." : "APIFY_API_TOKEN is missing.",
    };
  },
};
