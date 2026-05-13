import type { InstagramScraperProvider } from "./instagram";
import { downloadByUrl } from "./instagram";

export const manualProvider: InstagramScraperProvider = {
  name: "manual",
  async scrapeCreatorStats() {
    return {
      profilePicUrl: "",
      followers: 0,
      reelsCount30d: 0,
      avgViews30d: 0,
    };
  },
  async scrapeReels() {
    return [];
  },
  async refreshVideoUrl() {
    return null;
  },
  async downloadVideo(input) {
    return downloadByUrl(input.videoFileUrl);
  },
  async validateSession() {
    return { status: "ok", message: "Manual import requires no external session." };
  },
};
