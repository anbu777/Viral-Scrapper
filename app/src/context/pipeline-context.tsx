"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
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
  const logRef = useRef<string[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    logRef.current = [...logRef.current, `[${timestamp}] ${msg}`];
  };

  const runPipeline = useCallback(async (params: PipelineParams) => {
    if (running) return;
    setRunning(true);
    logRef.current = [];
    addLog("Creating pipeline run...");
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
      log: logRef.current,
    });

    try {
      const payload: Record<string, unknown> = {
        ...params,
        freeMode: params.freeMode ?? true,
      };
      if (params.scraperProvider) payload.scraperProvider = params.scraperProvider;
      if (params.aiProvider) payload.aiProvider = params.aiProvider;
      if (params.transcriptProvider) payload.transcriptProvider = params.transcriptProvider;
      if (params.videoProvider) payload.videoProvider = params.videoProvider;

      const response = await fetch("/api/pipeline/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Failed to create run (${response.status})`);
      const created = await response.json() as PipelineRun;
      addLog(`Run created: ${created.id.slice(0, 8)}...`);
      addLog(`Config: ${created.configName} | Provider: ${created.provider}`);

      let prevPhase = "";
      let prevCompleted = 0;
      let prevErrors = 0;

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const runRes = await fetch(`/api/pipeline/runs/${created.id}`);
        const run = await runRes.json() as PipelineRun;
        const phase = String(run.progress.phase || "loading");
        const completed = Number(run.progress.completed || 0);
        const total = Number(run.progress.total || 0);

        // Log phase transitions
        if (phase !== prevPhase) {
          if (phase === "scraping") addLog(`▶ Phase 1: Scraping creators (${total} total)`);
          else if (phase === "analyzing") addLog(`▶ Phase 2: Analyzing videos (${total} total)`);
          else if (phase === "done") addLog(`✓ Pipeline completed successfully`);
          else if (phase === "failed") addLog(`✗ Pipeline failed`);
          prevPhase = phase;
        }

        // Log progress increments
        if (completed > prevCompleted) {
          const diff = completed - prevCompleted;
          if (phase === "scraping") addLog(`  Scraped ${diff} creator${diff > 1 ? "s" : ""} (${completed}/${total})`);
          else if (phase === "analyzing") addLog(`  Analyzed ${diff} video${diff > 1 ? "s" : ""} (${completed}/${total})`);
          prevCompleted = completed;
        }

        // Log new errors
        if (run.errors.length > prevErrors) {
          for (let i = prevErrors; i < run.errors.length; i++) {
            const err = run.errors[i];
            addLog(`  ⚠ ${err.code}: ${err.message}${err.target ? ` [${err.target}]` : ""}`);
          }
          prevErrors = run.errors.length;
        }

        setProgress({
          status: run.status === "completed" ? "completed" : run.status === "failed" ? "error" : "running",
          phase: phase === "analyzing" ? "analyzing" : phase === "generating_scripts" ? "generating_scripts" : phase === "done" ? "done" : "scraping",
          activeTasks: [],
          creatorsCompleted: phase === "scraping" ? completed : total,
          creatorsTotal: phase === "scraping" ? total : 0,
          creatorsScraped: phase === "scraping" ? completed : total,
          videosAnalyzed: phase === "analyzing" || phase === "done" ? completed : 0,
          videosTotal: phase === "analyzing" || phase === "done" ? total : 0,
          scriptsGenerated: 0,
          scriptsTotal: 0,
          videoJobsQueued: 0,
          videoJobsTotal: 0,
          errors: run.errors.map((error) => `${error.code}: ${error.message}`),
          log: [...logRef.current],
        });

        if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
          if (run.status === "completed") addLog(`✓ Done — ${completed} videos processed, ${run.errors.length} errors`);
          if (run.status === "failed") addLog(`✗ Failed — check errors above`);
          if (run.status === "cancelled") addLog(`⊘ Cancelled by user`);
          // Final update with complete log
          setProgress((prev) => prev ? { ...prev, log: [...logRef.current] } : prev);
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addLog(`✗ Fatal error: ${msg}`);
      setProgress((prev) => ({
        ...(prev || { phase: "done" as const, activeTasks: [], creatorsCompleted: 0, creatorsTotal: 0, creatorsScraped: 0, videosAnalyzed: 0, videosTotal: 0, scriptsGenerated: 0, scriptsTotal: 0, videoJobsQueued: 0, videoJobsTotal: 0, log: [] }),
        status: "error" as const,
        errors: [msg],
        log: [...logRef.current],
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
