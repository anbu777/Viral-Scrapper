import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { repo } from "@/db/repositories";
import { getProviderForPlatform } from "@/lib/providers";
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

  await repo.creators.upsert(newCreator);

  try {
    const provider = getProviderForPlatform(platform);
    const stats = await provider.scrapeCreatorStats(newCreator.username);
    const updated = await repo.creators.update(newCreator.id, {
      profilePicUrl: stats.profilePicUrl,
      followers: stats.followers,
      reelsCount30d: stats.reelsCount30d,
      avgViews30d: stats.avgViews30d,
      lastScrapedAt: new Date().toISOString(),
    });
    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    console.error(`Failed to scrape stats for @${newCreator.username} on ${platform}:`, err);
  }

  return NextResponse.json(newCreator, { status: 201 });
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
