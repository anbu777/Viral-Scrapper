import { NextResponse } from "next/server";
import { runSchedulerTick, syncSchedulerJobs, getSchedulerStatus } from "@/lib/scheduler";
import { repo } from "@/db/repositories";

export async function GET() {
  // Sync jobs with current creators + settings
  await syncSchedulerJobs().catch(() => {});
  const [jobs, status, creators] = await Promise.all([
    repo.schedulerJobs.list(),
    getSchedulerStatus(),
    repo.creators.list(),
  ]);
  const creatorMap = new Map(creators.map((c) => [c.id, c]));
  const jobsWithCreator = jobs.map((j) => ({
    ...j,
    creator: creatorMap.get(j.creatorId) || null,
  }));
  return NextResponse.json({ status, jobs: jobsWithCreator });
}

export async function POST() {
  // Manual tick trigger
  try {
    await syncSchedulerJobs();
    const result = await runSchedulerTick();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
