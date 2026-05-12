import { NextResponse } from "next/server";
import { repo } from "@/db/repositories";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await repo.runs.update(id, {
    status: "cancelled",
    cancelRequested: true,
    completedAt: new Date().toISOString(),
    progress: { phase: "cancelled" },
  });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json(run);
}
