import { NextResponse } from "next/server";
import { runSchedulerTick } from "@/lib/scheduler";

/**
 * Background scheduler tick — fire-and-forget endpoint.
 * Triggered by middleware on regular requests.
 * Also can be hit by external cron services (Vercel Cron, etc.).
 */
export async function POST() {
  try {
    const result = await runSchedulerTick();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
