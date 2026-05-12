import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";

// GET /api/scripts — list all generated scripts
export async function GET() {
  return NextResponse.json(await repo.scripts.list());
}

// PATCH /api/scripts — toggle starred
export async function PATCH(req: NextRequest) {
  const { id, starred } = await req.json();
  await repo.scripts.update(id, { starred });
  return NextResponse.json({ success: true });
}

// DELETE /api/scripts — delete a script by id
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await repo.scripts.delete(id);
  return NextResponse.json({ success: true });
}
