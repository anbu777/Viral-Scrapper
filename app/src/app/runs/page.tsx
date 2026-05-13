"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  ChevronDown,
  Play,
  FileText,
  Film,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PipelineRun } from "@/lib/types";

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return "—";
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.floor((endTime - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  return `${minutes}m ${remainSec}s`;
}

export default function RunsPage() {
  const { toast } = useToast();
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const retry = async (id: string, configName: string) => {
    await fetch(`/api/pipeline/runs/${id}/retry`, { method: "POST" });
    toast.info("Retry started", `Re-running "${configName}"`);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Run History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track pipeline runs, errors, and retry failed jobs
          </p>
        </div>
        <Button onClick={load} disabled={loading} className="rounded-xl gap-2 glass border border-white/[0.08]" variant="ghost">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {runs.map((run) => {
          const isExpanded = expandedId === run.id;
          const progress = run.progress as {
            phase?: string;
            completed?: number;
            total?: number;
          };
          const completed = Number(progress?.completed || 0);
          const total = Number(progress?.total || 0);
          const hasErrors = run.errors.length > 0;

          return (
            <div
              key={run.id}
              className={`glass rounded-2xl overflow-hidden transition-all ${
                run.status === "running" ? "border-neon/30" : ""
              } ${hasErrors ? "border-amber-500/20" : ""}`}
            >
              <div className="p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StatusIcon status={run.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold truncate">{run.configName}</h2>
                        <StatusBadge status={run.status} />
                        <Badge
                          variant="secondary"
                          className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.08]"
                        >
                          {run.provider}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {formatRelative(run.createdAt)}
                        {run.startedAt && run.completedAt && (
                          <span>· took {formatDuration(run.startedAt, run.completedAt)}</span>
                        )}
                        {run.startedAt && !run.completedAt && run.status === "running" && (
                          <span>· {formatDuration(run.startedAt, null)} elapsed</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {run.status === "completed" && (
                      <Link href="/videos">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg h-8 gap-1.5 text-xs glass border border-white/[0.06]"
                        >
                          <Film className="h-3 w-3" />
                          Videos
                        </Button>
                      </Link>
                    )}
                    {(run.status === "failed" || hasErrors) && (
                      <Button
                        onClick={() => retry(run.id, run.configName)}
                        size="sm"
                        variant="ghost"
                        className="rounded-lg h-8 gap-1.5 text-xs glass border border-amber-500/20 text-amber-400"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry
                      </Button>
                    )}
                    <Button
                      onClick={() => setExpandedId(isExpanded ? null : run.id)}
                      size="sm"
                      variant="ghost"
                      className="rounded-lg h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </div>
                </div>

                {/* Progress bar (always visible) */}
                {(run.status === "running" || run.status === "completed") && total > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {progress.phase || "processing"} — {completed}/{total}
                      </span>
                      <span className="text-muted-foreground/70">
                        {Math.round((completed / total) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          run.status === "completed" ? "bg-emerald-500" : "bg-neon"
                        }`}
                        style={{ width: `${(completed / Math.max(total, 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error count summary */}
                {hasErrors && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span>
                      {run.errors.length} error{run.errors.length !== 1 ? "s" : ""} — click to expand
                    </span>
                  </div>
                )}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/[0.06] bg-black/20 p-5 space-y-4">
                  {/* Pipeline params summary */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Configuration
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <Detail label="Max Videos" value={String(run.params.maxVideos || "—")} />
                      <Detail label="Top K" value={String(run.params.topK || "—")} />
                      <Detail label="Days Lookback" value={String(run.params.nDays || "—")} />
                      <Detail label="AI Provider" value={run.params.aiProvider || "—"} />
                    </div>
                  </div>

                  {/* Errors detailed */}
                  {hasErrors && (
                    <div>
                      <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
                        Errors
                      </p>
                      <div className="space-y-1.5">
                        {run.errors.map((err, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-red-500/15 bg-red-500/5 p-2.5 text-[11px]"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="rounded-md text-[9px] bg-red-500/10 border-red-500/20 text-red-400"
                              >
                                {err.code}
                              </Badge>
                              {err.target && (
                                <span className="text-muted-foreground/60 font-mono text-[10px] truncate">
                                  {err.target}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-red-300/90 leading-relaxed">{err.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {runs.length === 0 && !loading && (
          <div className="glass rounded-2xl p-12 text-center">
            <Play className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <h3 className="mt-4 font-semibold">No runs yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run your first pipeline to see history here.
            </p>
            <Link href="/run">
              <Button className="mt-4 rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold">
                <Play className="h-4 w-4" />
                Run Pipeline
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: PipelineRun["status"] }) {
  const map = {
    completed: { icon: CheckCircle2, className: "text-emerald-400" },
    running: { icon: Loader2, className: "text-neon animate-spin" },
    failed: { icon: XCircle, className: "text-red-400" },
    cancelled: { icon: XCircle, className: "text-muted-foreground" },
    queued: { icon: Clock, className: "text-amber-400" },
  } as const;
  const config = map[status] || map.queued;
  const Icon = config.icon;
  return (
    <div className="h-9 w-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
      <Icon className={`h-4 w-4 ${config.className}`} />
    </div>
  );
}

function StatusBadge({ status }: { status: PipelineRun["status"] }) {
  const map = {
    completed: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    running: "bg-neon/10 border-neon/20 text-neon",
    failed: "bg-red-500/10 border-red-500/20 text-red-400",
    cancelled: "bg-white/[0.05] border-white/[0.08] text-muted-foreground",
    queued: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  } as const;
  return (
    <Badge variant="secondary" className={`rounded-md text-[10px] border ${map[status] || map.queued}`}>
      {status}
    </Badge>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{label}</p>
      <p className="text-foreground/80 font-medium mt-0.5">{value}</p>
    </div>
  );
}
