import { ProviderError } from "./errors";
import type { InstagramScraperProvider } from "./instagram";

export const metaProvider: InstagramScraperProvider = {
  name: "meta",
  async scrapeCreatorStats() {
    throw new ProviderError("VALIDATION_ERROR", "Meta official API provider is configured as a limited stub in v1.");
  },
  async scrapeReels() {
    throw new ProviderError("VALIDATION_ERROR", "Meta official API cannot replace public competitor scraping in v1.");
  },
  async refreshVideoUrl() {
    return null;
  },
  async downloadVideo() {
    throw new ProviderError("VALIDATION_ERROR", "Meta official API download is not available in v1.");
  },
  async validateSession() {
    return {
      status: "unknown_error",
      message: "Meta provider is present as a capability stub; use local/manual/apify for v1 scraping.",
    };
  },
};
