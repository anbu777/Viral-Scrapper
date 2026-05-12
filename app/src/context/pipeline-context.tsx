"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { PipelineProgress, PipelineParams, PipelineRun } from "@/lib/types";

interface PipelineContextValue {
  running: boolean;
  progress: PipelineProgress | null;
  runPipeline: (params: PipelineParams) => void;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const runPipeline = useCallback(async (params: PipelineParams) => {
    if (running) return;
    setRunning(true);
    setProgress({
      status: "running",
      phase: "scraping",
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
      errors: [],
      log: ["Creating run..."],
    });

    try {
      const response = await fetch("/api/pipeline/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          freeMode: params.freeMode ?? true,
          scraperProvider: params.scraperProvider || "local",
          aiProvider: params.aiProvider || "gemini",
          transcriptProvider: params.transcriptProvider || "gemini",
          videoProvider: params.videoProvider || "none",
        }),
      });
      if (!response.ok) throw new Error(`Failed to create run (${response.status})`);
      const created = await response.json() as PipelineRun;

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const runRes = await fetch(`/api/pipeline/runs/${created.id}`);
        const run = await runRes.json() as PipelineRun;
        const phase = String(run.progress.phase || "scraping");
        const completed = Number(run.progress.completed || 0);
        const total = Number(run.progress.total || 0);
        setProgress({
          status: run.status === "completed" ? "completed" : run.status === "failed" ? "error" : "running",
          phase: phase === "analyzing" ? "analyzing" : phase === "done" ? "done" : "scraping",
          activeTasks: [],
          creatorsCompleted: phase === "scraping" ? completed : total,
          creatorsTotal: phase === "scraping" ? total : 0,
          creatorsScraped: phase === "scraping" ? completed : total,
          videosAnalyzed: phase === "analyzing" ? completed : phase === "done" ? completed : 0,
          videosTotal: phase === "analyzing" ? total : phase === "done" ? total : 0,
          scriptsGenerated: 0,
          scriptsTotal: 0,
          videoJobsQueued: 0,
          videoJobsTotal: 0,
          errors: run.errors.map((error) => `${error.code}: ${error.message}`),
          log: [`Run ${run.id}`, `Provider: ${run.provider}`, `Phase: ${phase} (${completed}/${total})`],
        });
        if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") break;
      }
    } catch (err) {
      setProgress((prev) => ({
        ...(prev || { phase: "done" as const, activeTasks: [], creatorsCompleted: 0, creatorsTotal: 0, creatorsScraped: 0, videosAnalyzed: 0, videosTotal: 0, scriptsGenerated: 0, scriptsTotal: 0, videoJobsQueued: 0, videoJobsTotal: 0, log: [] }),
        status: "error" as const,
        errors: [err instanceof Error ? err.message : "Unknown error"],
      }));
    } finally {
      setRunning(false);
    }
  }, [running]);

  return (
    <PipelineContext.Provider value={{ running, progress, runPipeline }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider");
  return ctx;
}
