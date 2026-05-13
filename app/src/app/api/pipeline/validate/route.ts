import { NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import { getProviderSettings } from "@/lib/app-settings";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { configName?: string };
    if (!body.configName) {
      return NextResponse.json({ error: "configName is required" }, { status: 400 });
    }

    const configs = await repo.configs.list();
    const config = configs.find((c) => c.configName === body.configName);
    if (!config) {
      return NextResponse.json({
        valid: false,
        criticalErrors: [`Config "${body.configName}" not found`],
        warnings: [],
        info: {},
      });
    }

    const allCreators = await repo.creators.list();
    const matchingCreators = allCreators.filter(
      (c) => c.category.toLowerCase() === config.creatorsCategory.toLowerCase()
    );

    const settings = await getProviderSettings();
    const criticalErrors: string[] = [];
    const warnings: string[] = [];

    // Check creators
    if (matchingCreators.length === 0) {
      const availableCategories = [...new Set(allCreators.map((c) => c.category))];
      criticalErrors.push(
        `No creators found for category "${config.creatorsCategory}". Available categories: ${
          availableCategories.join(", ") || "(none)"
        }`
      );
    }

    // Check Gemini API key
    if (!settings.ai.analysis.geminiKey && !process.env.GEMINI_API_KEY) {
      criticalErrors.push("Gemini API key not configured. Configure it in Settings.");
    }

    // Check scraper provider
    const platforms = [...new Set(matchingCreators.map((c) => c.platform || "instagram"))];
    for (const platform of platforms) {
      if (platform === "instagram" && settings.scraping.instagram.provider === "apify") {
        if (!settings.scraping.instagram.apifyToken && !process.env.APIFY_API_TOKEN) {
          warnings.push("Instagram scraping uses Apify but no token configured. Will fall back to manual.");
        }
      }
      if (platform === "tiktok" && settings.scraping.tiktok.provider === "apify_tiktok") {
        if (!settings.scraping.tiktok.apifyToken && !process.env.APIFY_API_TOKEN) {
          warnings.push("TikTok scraping uses Apify TikTok but no token configured.");
        }
      }
      if (platform === "youtube_shorts" && settings.scraping.youtube.provider === "youtube_api") {
        if (!settings.scraping.youtube.apiKey && !process.env.YOUTUBE_API_KEY) {
          warnings.push("YouTube scraping uses YouTube API but no key configured.");
        }
      }
    }

    // Calculate estimated values
    const estimatedVideos = matchingCreators.length * 3; // topK default
    const estimatedMinutes = Math.ceil((matchingCreators.length * 1.5) + (estimatedVideos * 1.2));

    return NextResponse.json({
      valid: criticalErrors.length === 0,
      criticalErrors,
      warnings,
      info: {
        configName: config.configName,
        category: config.creatorsCategory,
        creatorsCount: matchingCreators.length,
        creators: matchingCreators.map((c) => ({
          username: c.username,
          platform: c.platform || "instagram",
          followers: c.followers,
        })),
        platforms,
        estimatedVideos,
        estimatedMinutes,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
