import { NextRequest, NextResponse } from "next/server";
import { runSchedulerTick, syncSchedulerJobs, getSchedulerStatus } from "@/lib/scheduler";
import { repo } from "@/db/repositories";
import { getProviderSettings, saveProviderSettings } from "@/lib/app-settings";

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

// PATCH /api/scheduler — enable or disable the scheduler globally
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { enabled?: boolean; platform?: "instagram" | "tiktok" | "youtube" };
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
    }
    const settings = await getProviderSettings();
    const platform = body.platform;
    if (platform) {
      // Toggle a specific platform
      await saveProviderSettings({
        schedule: {
          ...settings.schedule,
          [platform]: { ...settings.schedule[platform], enabled: body.enabled },
        },
      });
    } else {
      // Toggle all platforms at once
      await saveProviderSettings({
        schedule: {
          ...settings.schedule,
          instagram: { ...settings.schedule.instagram, enabled: body.enabled },
          tiktok: { ...settings.schedule.tiktok, enabled: body.enabled },
          youtube: { ...settings.schedule.youtube, enabled: body.enabled },
        },
      });
    }
    // Re-sync jobs to reflect new enabled state
    await syncSchedulerJobs().catch(() => {});
    const fresh = await getSchedulerStatus();
    return NextResponse.json({ success: true, enabled: body.enabled, status: fresh });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
