import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";

// GET /api/calendar
export async function GET() {
  try {
    return NextResponse.json(await repo.contentCalendar.list());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST /api/calendar
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.scheduledDate || !body.platform) {
      return NextResponse.json({ error: "scheduledDate and platform are required" }, { status: 400 });
    }
    const created = await repo.contentCalendar.create({
      scriptId: body.scriptId ?? null,
      scheduledDate: body.scheduledDate,
      platform: body.platform,
      status: body.status || "draft",
      postedUrl: body.postedUrl ?? null,
      notes: body.notes ?? null,
      title: body.title || "",
    });
    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// PATCH /api/calendar
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { id, ...updates } = body;
    await repo.contentCalendar.update(id, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// DELETE /api/calendar?id=xxx
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await repo.contentCalendar.delete(id);
  return NextResponse.json({ success: true });
}
