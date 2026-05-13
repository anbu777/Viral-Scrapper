import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { repo } from "@/db/repositories";
import { getStatsProviderForPlatform } from "@/lib/providers";
import type { Creator, SocialPlatform } from "@/lib/types";

const PlatformEnum = z.enum(["instagram", "tiktok", "youtube_shorts"]);

const CreateSchema = z.object({
  username: z.string().min(1),
  category: z.string().min(1),
  platform: PlatformEnum.optional(),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  platform: PlatformEnum.optional(),
  groupId: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  return NextResponse.json(await repo.creators.list(category || undefined));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const platform: SocialPlatform = parsed.data.platform ?? "instagram";
  const newCreator: Creator = {
    id: uuid(),
    platform,
    username: parsed.data.username.replace(/^@/, ""),
    category: parsed.data.category,
    profilePicUrl: "",
    followers: 0,
    reelsCount30d: 0,
    avgViews30d: 0,
    lastScrapedAt: "",
  };

  // Always save the creator first — stats scrape is best-effort
  await repo.creators.upsert(newCreator);

  let warning: string | undefined;
  try {
    const provider = getStatsProviderForPlatform(platform);
    const stats = await provider.scrapeCreatorStats(newCreator.username);

    // Auto-detect aliases: if yt-dlp resolved a different uploader name, add it
    const aliases: string[] = [];
    const detectedAlias = (stats as { detectedAlias?: string }).detectedAlias;
    if (detectedAlias) {
      aliases.push(detectedAlias);
    }

    // Merge with any existing aliases (in case of upsert on existing creator)
    const existingCreators = await repo.creators.list();
    const existingCreator = existingCreators.find(
      c => c.platform === platform && c.username === newCreator.username
    );
    const existingAliases = existingCreator?.aliases || [];
    const mergedAliases = [...new Set([...existingAliases, ...aliases])];

    const updated = await repo.creators.update(newCreator.id, {
      profilePicUrl: stats.profilePicUrl,
      followers: stats.followers,
      reelsCount30d: stats.reelsCount30d,
      avgViews30d: stats.avgViews30d,
      lastScrapedAt: new Date().toISOString(),
      ...(mergedAliases.length > 0 ? { aliases: mergedAliases } : {}),
    });

    if (stats.followers === 0 && stats.reelsCount30d === 0) {
      warning = `Creator saved but stats could not be fully scraped. Try importing a video URL first, then refresh stats.`;
    }

    return NextResponse.json({ ...(updated || newCreator), warning }, { status: 201 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to scrape stats for @${newCreator.username} on ${platform}:`, errorMsg);
    warning = `Creator saved but stats scraping failed: ${errorMsg}. You can try refreshing later.`;
  }

  return NextResponse.json({ ...newCreator, warning }, { status: 201 });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const updated = await repo.creators.update(parsed.data.id, parsed.data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await repo.creators.delete(id);
  return NextResponse.json({ success: true });
}
