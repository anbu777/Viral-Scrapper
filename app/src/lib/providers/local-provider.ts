import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import type { Page } from "playwright";
import { getEnv } from "@/lib/env";
import type { InstagramScraperProvider, ScrapeReelsInput } from "./instagram";
import { downloadByUrl } from "./instagram";
import { ProviderError } from "./errors";

function localProfileDir() {
  const env = getEnv();
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), env.LOCAL_BROWSER_PROFILE_DIR);
}

async function withInstagramPage<T>(fn: (page: Page) => Promise<T>) {
  const profileDir = localProfileDir();
  await mkdir(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1280, height: 900 },
  });
  try {
    const page = context.pages()[0] || await context.newPage();
    return await fn(page);
  } finally {
    await context.close();
  }
}

function detectHtmlStatus(html: string) {
  const lower = html.toLowerCase();
  if (lower.includes("login") && lower.includes("password")) return "login_required" as const;
  if (lower.includes("challenge")) return "challenge_required" as const;
  if (lower.includes("try again later")) return "rate_limited" as const;
  if (lower.includes("private")) return "private" as const;
  if (lower.includes("page isn't available") || lower.includes("not found")) return "deleted" as const;
  return "ok" as const;
}

export const localProvider: InstagramScraperProvider = {
  name: "local",
  async scrapeCreatorStats(username) {
    return withInstagramPage(async (page) => {
      await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const html = await page.content();
      const status = detectHtmlStatus(html);
      if (status !== "ok") throw new ProviderError(status === "rate_limited" ? "RATE_LIMIT" : "PROVIDER_AUTH", `Instagram local session status: ${status}`);
      const profilePicUrl = await page.locator("img").first().getAttribute("src").catch(() => "") || "";
      return {
        profilePicUrl,
        followers: 0,
        reelsCount30d: 0,
        avgViews30d: 0,
      };
    });
  },
  async scrapeReels(input: ScrapeReelsInput) {
    return withInstagramPage(async (page) => {
      await page.goto(`https://www.instagram.com/${input.username}/reels/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const html = await page.content();
      const status = detectHtmlStatus(html);
      if (status !== "ok") throw new ProviderError(status === "rate_limited" ? "RATE_LIMIT" : "PROVIDER_AUTH", `Instagram local session status: ${status}`);
      const links = await page.locator('a[href*="/reel/"], a[href*="/p/"]').evaluateAll((anchors) =>
        [...new Set(anchors.map((a) => (a as HTMLAnchorElement).href))].slice(0, 50)
      );
      return links.slice(0, input.maxVideos).map((url) => ({
        platform: "instagram" as const,
        sourcePostUrl: url,
        shortcode: url.split("/").filter(Boolean).pop() || "",
        creatorUsername: input.username,
        caption: "",
        thumbnailUrl: "",
        videoFileUrl: null,
        postedAt: "",
        views: 0,
        likes: 0,
        comments: 0,
        rawProviderPayload: { url, localBrowser: true },
      }));
    });
  },
  async refreshVideoUrl() {
    return null;
  },
  async downloadVideo(input) {
    return downloadByUrl(input.videoFileUrl);
  },
  async validateSession() {
    const profileDir = localProfileDir();
    if (!existsSync(profileDir)) {
      return {
        status: "login_required",
        message: "Local browser profile does not exist yet. Run validation once with a visible/manual login workflow before scraping.",
      };
    }
    try {
      return await withInstagramPage(async (page) => {
        await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
        const status = detectHtmlStatus(await page.content());
        return {
          status,
          message: status === "ok" ? "Local Instagram browser session loaded." : `Local Instagram session status: ${status}`,
        };
      });
    } catch (error) {
      return { status: "unknown_error", message: error instanceof Error ? error.message : "Unknown local browser error" };
    }
  },
};
