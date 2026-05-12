"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, RotateCcw } from "lucide-react";
import type { PipelineRun } from "@/lib/types";

export default function RunsPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline/runs");
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const retry = async (id: string) => {
    await fetch(`/api/pipeline/runs/${id}/retry`, { method: "POST" });
    await load();
  };

  const loadDetail = async (id: string) => {
    if (detailId === id && detail) {
      setDetailId(null);
      setDetail(null);
      return;
    }
    const res = await fetch(`/api/pipeline/runs/${id}?detail=1`);
    setDetail((await res.json()) as Record<string, unknown>);
    setDetailId(id);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Run History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track pipeline runs, partial failures, and retries.</p>
        </div>
        <Button onClick={load} disabled={loading} className="rounded-xl gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {runs.map((run) => (
          <div key={run.id} className="glass rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">{run.configName}</h2>
              <Badge>{run.status}</Badge>
              <Badge variant="secondary">{run.provider}</Badge>
              {run.freeMode && <Badge className="bg-emerald-500/15 text-emerald-300">Free mode</Badge>}
              <span className="ml-auto text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</span>
            </div>
            <pre className="overflow-auto rounded-xl bg-black/30 p-3 text-[11px] text-muted-foreground">
              {JSON.stringify({ progress: run.progress, errors: run.errors }, null, 2)}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => loadDetail(run.id)} size="sm" variant="outline" className="rounded-xl text-xs">
                {detailId === run.id ? "Hide audit" : "Audit trail"}
              </Button>
              {(run.status === "failed" || run.errors.length > 0) && (
                <Button onClick={() => retry(run.id)} size="sm" variant="ghost" className="rounded-xl gap-2">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}
            </div>
            {detailId === run.id && detail !== null ? (
              <pre className="overflow-auto rounded-xl bg-black/40 p-3 text-[10px] text-muted-foreground max-h-64">
                {JSON.stringify(detail, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
        {runs.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground">No runs yet.</div>
        )}
      </div>
    </div>
  );
}
