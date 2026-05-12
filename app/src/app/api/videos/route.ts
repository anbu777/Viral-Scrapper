import { NextResponse } from "next/server";
import { repo } from "@/db/repositories";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const configName = searchParams.get("configName");
  const creator = searchParams.get("creator");

  return NextResponse.json(await repo.videos.list({
    configName: configName || undefined,
    creator: creator || undefined,
  }));
}

export async function PATCH(request: Request) {
  const { id, starred } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const video = await repo.videos.find(id);
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await repo.videos.update(id, { starred }));
}
