/**
 * Legacy SSE pipeline endpoint.
 *
 * This now delegates to the DB-backed pipeline-runs system instead of the
 * old CSV-based pipeline.ts. The SSE stream reports progress by polling the
 * run status from the database until completion.
 */

import { createPipelineRun } from "@/lib/pipeline-runs";
import { repo } from "@/db/repositories";
import type { PipelineParams } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const params: PipelineParams = await request.json();

  // Create a DB-backed pipeline run (processes in background)
  const run = await createPipelineRun(params);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Poll the run status and stream progress updates via SSE
        let completed = false;
        while (!completed) {
          await new Promise((r) => setTimeout(r, 2000));
          const current = await repo.runs.get(run.id);
          if (!current) break;

          const progress = {
            status: current.status === "running" ? "running" : current.status === "completed" ? "completed" : current.status === "failed" ? "error" : "running",
            phase: (current.progress as { phase?: string })?.phase || "loading",
            activeTasks: [],
            creatorsCompleted: (current.progress as { completed?: number })?.completed || 0,
            creatorsTotal: (current.progress as { total?: number })?.total || 0,
            creatorsScraped: 0,
            videosAnalyzed: (current.progress as { completed?: number })?.completed || 0,
            videosTotal: (current.progress as { total?: number })?.total || 0,
            scriptsGenerated: 0,
            scriptsTotal: 0,
            videoJobsQueued: 0,
            videoJobsTotal: 0,
            errors: current.errors.map((e) => e.message),
            log: [`Pipeline run ${run.id} — ${current.status}`],
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));

          if (current.status === "completed" || current.status === "failed" || current.status === "cancelled") {
            completed = true;
          }
        }
      } catch (err) {
        const errorData = `data: ${JSON.stringify({
          status: "error",
          errors: [err instanceof Error ? err.message : "Unknown error"],
          log: [],
          activeTasks: [],
          creatorsCompleted: 0,
          creatorsTotal: 0,
          creatorsScraped: 0,
          videosAnalyzed: 0,
          videosTotal: 0,
          scriptsGenerated: 0,
          scriptsTotal: 0,
          videoJobsQueued: 0,
          videoJobsTotal: 0,
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
