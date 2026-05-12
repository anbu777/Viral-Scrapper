import { NextResponse } from "next/server";
import { repo } from "@/db/repositories";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const run = await repo.runs.get(id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (searchParams.get("detail") === "1") {
    const scrapeRunItems = await repo.scrapeRunItems.listByRun(id);
    const analysisRuns = await repo.analysisRuns.listByRunId(id);
    return NextResponse.json({ run, scrapeRunItems, analysisRuns });
  }
  return NextResponse.json(run);
}
