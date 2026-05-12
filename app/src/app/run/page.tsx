"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Loader2, CheckCircle2, XCircle, Terminal, Zap, ChevronDown, ArrowRight, Film, AlertTriangle, FileText, Video, Brain, AlignLeft } from "lucide-react";
import { usePipeline } from "@/context/pipeline-context";
import type { Config } from "@/lib/types";

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export default function RunPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [selectedConfig, setSelectedConfig] = useState("");
  const [maxVideos, setMaxVideos] = useState(20);
  const [topK, setTopK] = useState(3);
  const [nDays, setNDays] = useState(30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoAnalysis, setAutoAnalysis] = useState(true);
  const [autoTranscript, setAutoTranscript] = useState(false);
  const [autoScripts, setAutoScripts] = useState(true);
  const [autoVideos, setAutoVideos] = useState(true);
  const [resumeMode, setResumeMode] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { running, progress, runPipeline } = usePipeline();

  useEffect(() => {
    fetch("/api/configs").then((r) => r.json()).then((d) => setConfigs(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progress?.log.length]);

  const handleRun = () => {
    if (!selectedConfig) return;
    runPipeline({
      configName: selectedConfig,
      maxVideos,
      topK,
      nDays,
      autoAnalysis,
      autoTranscript,
      autoGenerateScripts: autoAnalysis && autoScripts,
      autoGenerateVideos: autoAnalysis && autoScripts && autoVideos,
      skipScraping: resumeMode,
    });
  };

  const numPhases = 2 + (autoAnalysis && autoScripts ? 1 : 0) + (autoAnalysis && autoScripts && autoVideos ? 1 : 0);
  const phaseSize = 100 / numPhases;

  const totalProgress = (() => {
    if (!progress) return 0;
    const { phase, creatorsTotal, creatorsScraped, videosTotal, videosAnalyzed, scriptsTotal, scriptsGenerated, videoJobsTotal, videoJobsQueued } = progress;
    if (phase === "scraping") return creatorsTotal > 0 ? (creatorsScraped / creatorsTotal) * phaseSize : 0;
    if (phase === "analyzing") return phaseSize + (videosTotal > 0 ? (videosAnalyzed / videosTotal) * phaseSize : 0);
    if (phase === "generating_scripts") return phaseSize * 2 + (scriptsTotal > 0 ? (scriptsGenerated / scriptsTotal) * phaseSize : 0);
    if (phase === "generating_videos") return phaseSize * 3 + (videoJobsTotal > 0 ? (videoJobsQueued / videoJobsTotal) * phaseSize : 0);
    return 100;
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Run Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyze competitor content and generate new video concepts
        </p>
      </div>

      {/* Config Form */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-neon" />
          <h2 className="text-sm font-semibold">Pipeline Configuration</h2>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Config</Label>
            <Select value={selectedConfig} onValueChange={setSelectedConfig}>
              <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-11">
                <SelectValue placeholder="Select a config..." />
              </SelectTrigger>
              <SelectContent>
                {configs.filter((c) => c.configName).map((c) => (
                  <SelectItem key={c.id} value={c.configName}>{c.configName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced settings
          </button>

          {showAdvanced && (
            <div className="grid gap-4 md:grid-cols-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <Label className="text-xs text-muted-foreground">Max Videos per Creator</Label>
                <Input
                  type="number"
                  value={maxVideos}
                  onChange={(e) => setMaxVideos(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="mt-1.5 rounded-xl glass border-white/[0.08] h-11"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Top K to Analyze</Label>
                <Input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  min={1}
                  max={10}
                  className="mt-1.5 rounded-xl glass border-white/[0.08] h-11"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Days Lookback</Label>
                <Input
                  type="number"
                  value={nDays}
                  onChange={(e) => setNDays(Number(e.target.value))}
                  min={1}
                  max={365}
                  className="mt-1.5 rounded-xl glass border-white/[0.08] h-11"
                />
              </div>
            </div>
          )}

          {/* Resume mode */}
          <div
            onClick={() => setResumeMode(!resumeMode)}
            className={`rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition-colors ${
              resumeMode
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]"
            }`}
          >
            <div className="relative mt-0.5 shrink-0">
              <div className={`h-5 w-9 rounded-full transition-colors ${resumeMode ? "bg-amber-500" : "bg-white/[0.08]"}`} />
              <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${resumeMode ? "translate-x-4" : ""}`} />
            </div>
            <div>
              <div className="text-xs font-semibold flex items-center gap-1.5">
                Resume from saved videos
                {resumeMode && <span className="text-[10px] font-normal text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">Active</span>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Skip scraping &amp; Gemini analysis — use videos already saved for this config. Only processes videos that don&apos;t have scripts yet.
              </p>
            </div>
          </div>

          {/* Pipeline step checklist */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pipeline Steps</p>

            {/* Gemini Analysis */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input type="checkbox" className="sr-only peer" checked={autoAnalysis} onChange={(e) => setAutoAnalysis(e.target.checked)} />
                <div className="h-5 w-9 rounded-full bg-white/[0.08] peer-checked:bg-neon transition-colors" />
                <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Brain className="h-3 w-3 text-neon" />
                  Gemini Analysis
                  <span className="text-[10px] font-normal text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">costs API credits</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Upload each video to Gemini and analyze why it went viral</p>
              </div>
            </label>

            {/* Auto Transcript */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input type="checkbox" className="sr-only peer" checked={autoTranscript} onChange={(e) => setAutoTranscript(e.target.checked)} />
                <div className="h-5 w-9 rounded-full bg-white/[0.08] peer-checked:bg-neon transition-colors" />
                <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <AlignLeft className="h-3 w-3 text-neon" />
                  Auto Transcript
                  <span className="text-[10px] font-normal text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">costs API credits</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Extract word-for-word spoken transcript — ready to copy-paste, no analysis</p>
              </div>
            </label>

            <div className="border-t border-white/[0.06] pt-3 space-y-3">
              {/* Auto Scripts */}
              <label className={`flex items-start gap-3 cursor-pointer group ${!autoAnalysis ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="relative mt-0.5">
                  <input type="checkbox" className="sr-only peer" checked={autoAnalysis && autoScripts} onChange={(e) => setAutoScripts(e.target.checked)} disabled={!autoAnalysis} />
                  <div className="h-5 w-9 rounded-full bg-white/[0.08] peer-checked:bg-neon transition-colors" />
                  <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <FileText className="h-3 w-3 text-neon" />
                    Auto-generate scripts
                    {!autoAnalysis && <span className="text-[10px] font-normal text-muted-foreground bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-0.5">requires Analysis</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Write a full script for every analyzed video using your Voice Profile</p>
                </div>
              </label>

              {/* Auto Videos */}
              <label className={`flex items-start gap-3 cursor-pointer group ${!autoAnalysis || !autoScripts ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="relative mt-0.5">
                  <input type="checkbox" className="sr-only peer" checked={autoAnalysis && autoScripts && autoVideos} onChange={(e) => setAutoVideos(e.target.checked)} disabled={!autoAnalysis || !autoScripts} />
                  <div className="h-5 w-9 rounded-full bg-white/[0.08] peer-checked:bg-neon transition-colors" />
                  <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Video className="h-3 w-3 text-neon" />
                    Auto-generate videos
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Queue D-ID lip-sync video jobs for each script → check Telegram for approval</p>
                </div>
              </label>
            </div>
          </div>

          <Button
            onClick={handleRun}
            disabled={running || !selectedConfig}
            size="lg"
            className="w-full rounded-xl h-12 bg-neon text-black hover:bg-neon/90 border-0 glow-sm transition-all duration-300 hover:glow text-sm font-semibold"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Pipeline...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Full Pipeline
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="space-y-4">
          {/* Status card */}
          <div className="glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {progress.status === "running" && <Loader2 className="h-4 w-4 text-neon animate-spin" />}
                {progress.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {progress.status === "error" && <XCircle className="h-4 w-4 text-red-400" />}
                <h2 className="text-sm font-semibold">
                  {progress.status === "running" && progress.phase === "scraping" && "Phase 1 — Scraping creators..."}
                  {progress.status === "running" && progress.phase === "analyzing" && "Phase 2 — Analyzing videos..."}
                  {progress.status === "running" && progress.phase === "generating_scripts" && "Phase 3 — Writing scripts..."}
                  {progress.status === "running" && progress.phase === "generating_videos" && "Phase 4 — Generating videos..."}
                  {progress.status === "completed" && "Pipeline complete"}
                  {progress.status === "error" && "Pipeline failed"}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {progress.phase === "scraping" && (
                  <span>Creators: <span className="text-foreground">{progress.creatorsScraped}/{progress.creatorsTotal}</span></span>
                )}
                {progress.phase === "analyzing" && (
                  <span>Videos: <span className="text-foreground">{progress.videosAnalyzed}/{progress.videosTotal}</span></span>
                )}
                {progress.phase === "generating_scripts" && (
                  <span>Scripts: <span className="text-foreground">{progress.scriptsGenerated}/{progress.scriptsTotal}</span></span>
                )}
                {progress.phase === "generating_videos" && (
                  <span>Videos queued: <span className="text-foreground">{progress.videoJobsQueued}/{progress.videoJobsTotal}</span></span>
                )}
                {progress.phase === "done" && (
                  <span className="text-emerald-400">{progress.videosAnalyzed} analyzed · {progress.scriptsGenerated} scripts · {progress.videoJobsQueued} videos</span>
                )}
                {progress.errors.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    {progress.errors.length}
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress.status === "completed"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : progress.status === "error"
                      ? "bg-gradient-to-r from-red-500 to-orange-500"
                      : "bg-gradient-to-r from-neon to-emerald-400"
                  }`}
                  style={{ width: `${progress.status === "completed" ? 100 : totalProgress}%` }}
                />
              </div>
            </div>

            {/* Active tasks */}
            {progress.activeTasks.length > 0 && (
              <div className="space-y-2">
                {progress.activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.04] px-3 py-2"
                  >
                    <Loader2 className="h-3 w-3 text-neon animate-spin shrink-0" />
                    <span className="text-xs font-medium text-foreground/80">@{task.creator}</span>
                    <span className="text-[11px] text-muted-foreground">{task.step}</span>
                    {task.views && (
                      <span className="ml-auto text-[11px] text-muted-foreground/60">
                        {formatViews(task.views)} views
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Completion CTAs */}
            {progress.status === "completed" && (
              <div className="flex gap-2">
                {progress.videoJobsQueued > 0 && (
                  <Button asChild className="flex-1 rounded-xl h-11 bg-neon text-black hover:bg-neon/90 border-0 font-semibold gap-2">
                    <Link href="/scripts">
                      <Video className="h-4 w-4" />
                      Watch {progress.videoJobsQueued} Videos
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {progress.scriptsGenerated > 0 && progress.videoJobsQueued === 0 && (
                  <Button asChild className="flex-1 rounded-xl h-11 bg-neon text-black hover:bg-neon/90 border-0 font-semibold gap-2">
                    <Link href="/scripts">
                      <FileText className="h-4 w-4" />
                      View {progress.scriptsGenerated} Scripts
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {progress.videosAnalyzed > 0 && (
                  <Button asChild variant="outline" className="flex-1 rounded-xl h-11 border-white/[0.08] font-semibold gap-2">
                    <Link href="/videos">
                      <Film className="h-4 w-4" />
                      Videos ({progress.videosAnalyzed})
                    </Link>
                  </Button>
                )}
              </div>
            )}

            {/* Errors summary */}
            {progress.errors.length > 0 && (
              <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-3 space-y-1">
                <p className="text-[11px] font-medium text-red-400">Errors ({progress.errors.length})</p>
                {progress.errors.map((err, i) => (
                  <p key={i} className="text-[11px] text-red-400/70 leading-relaxed">{err}</p>
                ))}
              </div>
            )}
          </div>

          {/* Log — collapsible */}
          <details className="glass rounded-2xl overflow-hidden">
            <summary className="p-4 flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Terminal className="h-4 w-4" />
              <span className="font-medium">Log</span>
              <Badge variant="secondary" className="ml-auto rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
                {progress.log.length} entries
              </Badge>
            </summary>
            <div className="border-t border-white/[0.06]">
              <ScrollArea className="h-[300px] p-4">
                <div className="space-y-0.5 font-mono text-[11px]">
                  {progress.log.map((line, i) => (
                    <div
                      key={i}
                      className={`leading-5 ${
                        line.includes("Error") || line.includes("error")
                          ? "text-red-400"
                          : line.includes("done") || line.includes("complete") || line.includes("Complete")
                          ? "text-emerald-400/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {line}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
