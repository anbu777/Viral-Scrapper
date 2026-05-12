import { NextResponse } from "next/server";
import { retryPipelineRun } from "@/lib/pipeline-runs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await retryPipelineRun(id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json(run, { status: 202 });
}
