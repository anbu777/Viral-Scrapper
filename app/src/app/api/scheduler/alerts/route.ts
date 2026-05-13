import { NextResponse } from "next/server";
import { repo } from "@/db/repositories";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unseen = searchParams.get("unseen") === "true";
  const includeDismissed = searchParams.get("includeDismissed") === "true";
  const alerts = await repo.viralAlerts.list({
    unseen: unseen || undefined,
    dismissed: includeDismissed ? undefined : false,
  });
  // Hydrate with video data
  const videos = await repo.videos.list();
  const videoMap = new Map(videos.map((v) => [v.id, v]));
  return NextResponse.json(
    alerts.map((a) => ({
      ...a,
      video: videoMap.get(a.videoId) || null,
    }))
  );
}

export async function PATCH(request: Request) {
  const { id, seen, dismissed } = await request.json() as {
    id: string;
    seen?: boolean;
    dismissed?: boolean;
  };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await repo.viralAlerts.update(id, {
    ...(seen !== undefined ? { seen } : {}),
    ...(dismissed !== undefined ? { dismissed } : {}),
  });
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  // Bulk mark as seen
  const body = await request.json() as { action: "markAllSeen" };
  if (body.action === "markAllSeen") {
    const alerts = await repo.viralAlerts.list({ unseen: true });
    for (const alert of alerts) {
      await repo.viralAlerts.update(alert.id, { seen: true });
    }
    return NextResponse.json({ marked: alerts.length });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
