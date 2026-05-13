import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";

// GET /api/performance — list posted content with metrics
export async function GET() {
  try {
    const [posted, scripts] = await Promise.all([
      repo.postedContent.list(),
      repo.scripts.list(),
    ]);
    const scriptMap = new Map(scripts.map((s) => [s.id, s]));
    const enriched = posted.map((p) => ({
      ...p,
      script: p.scriptId ? scriptMap.get(p.scriptId) || null : null,
    }));
    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST /api/performance — register a posted item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.postedUrl || !body.platform) {
      return NextResponse.json(
        { error: "postedUrl and platform are required" },
        { status: 400 }
      );
    }
    const created = await repo.postedContent.create({
      scriptId: body.scriptId ?? null,
      postedUrl: body.postedUrl,
      platform: body.platform,
      postedAt: body.postedAt || new Date().toISOString(),
      views24h: body.views24h || 0,
      views48h: body.views48h || 0,
      views7d: body.views7d || 0,
      likes7d: body.likes7d || 0,
      comments7d: body.comments7d || 0,
      lastCheckedAt: body.lastCheckedAt ?? null,
    });
    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// PATCH /api/performance — update metrics
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { id, ...updates } = body;
    await repo.postedContent.update(id, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// DELETE /api/performance?id=xxx
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await repo.postedContent.delete(id);
  return NextResponse.json({ success: true });
}
