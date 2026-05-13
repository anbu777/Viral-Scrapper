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

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const ids = searchParams.get("ids");

  if (ids) {
    // Bulk delete: ?ids=id1,id2,id3
    const idList = ids.split(",").filter(Boolean);
    for (const videoId of idList) {
      await repo.videos.delete(videoId);
    }
    return NextResponse.json({ deleted: idList.length });
  }

  if (id) {
    await repo.videos.delete(id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id or ids required" }, { status: 400 });
}
