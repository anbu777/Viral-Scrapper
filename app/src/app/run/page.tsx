"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal,
  Zap,
  ChevronDown,
  ArrowRight,
  Film,
  AlertTriangle,
  FileText,
  Video,
  Brain,
  AlignLeft,
  Users,
  Clock,
  Settings,
} from "lucide-react";
import { usePipeline } from "@/context/pipeline-context";
import { useToast } from "@/hooks/use-toast";
import type { Config } from "@/lib/types";

interface ValidationResult {
  valid: boolean;
  criticalErrors: string[];
  warnings: string[];
  info: {
    configName?: string;
    category?: string;
    creatorsCount?: number;
    creators?: Array<{ username: string; platform: string; followers: number }>;
    platforms?: string[];
    estimatedVideos?: number;
    estimatedMinutes?: number;
  };
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export default function RunPage() {
  return (
    <Suspense>
      <RunContent />
    </Suspense>
  );
}

function RunContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [selectedConfig, setSelectedConfig] = useState(searchParams.get("config") || "");
  const [maxVideos, setMaxVideos] = useState(20);
  const [topK, setTopK] = useState(3);
  const [nDays, setNDays] = useState(30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoAnalysis, setAutoAnalysis] = useState(true);
  const [autoTranscript, setAutoTranscript] = useState(false);
  const [autoScripts, setAutoScripts] = useState(true);
  const [autoVideos, setAutoVideos] = useState(false);
  const [resumeMode, setResumeMode] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { running, progress, runPipeline } = usePipeline();

  useEffect(() => {
    fetch("/api/configs")
      .then((r) => r.json())
      .then((d) => setConfigs(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Validate whenever config changes
  useEffect(() => {
    if (!selectedConfig) {
      setValidation(null);
      return;
    }
    setValidating(true);
    fetch("/api/pipeline/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configName: selectedConfig }),
    })
      .then((r) => r.json())
      .then((d: ValidationResult) => setValidation(d))
      .catch(() => setValidation(null))
      .finally(() => setValidating(false));
  }, [selectedConfig]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progress?.log.length]);

  const handleRun = () => {
    if (!selectedConfig) {
      toast.error("No config selected", "Please select a config first");
      return;
    }
    if (validation && !validation.valid) {
      toast.error("Cannot run pipeline", validation.criticalErrors[0]);
      return;
    }
    runPipeline({
      configName: selectedConfig,
      maxVideos,
      topK,
      nDays,
      autoAnalysis,
      autoTranscript,
      autoGenerateScripts: autoAnalysis && autoScripts,
      autoGenerateVideos: false,
      skipScraping: resumeMode,
    });
    toast.info("Pipeline started", `Running "${selectedConfig}"`);
  };

  const totalProgress = (() => {
    if (!progress) return 0;
    const numPhases = 2 + (autoAnalysis && autoScripts ? 1 : 0);
    const phaseSize = 100 / numPhases;
    const { phase, creatorsTotal, creatorsScraped, videosTotal, videosAnalyzed, scriptsTotal, scriptsGenerated } = progress;
    if (phase === "scraping") return creatorsTotal > 0 ? (creatorsScraped / creatorsTotal) * phaseSize : 0;
    if (phase === "analyzing")
      return phaseSize + (videosTotal > 0 ? (videosAnalyzed / videosTotal) * phaseSize : 0);
    if (phase === "generating_scripts")
      return phaseSize * 2 + (scriptsTotal > 0 ? (scriptsGenerated / scriptsTotal) * phaseSize : 0);
    return 100;
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Run Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scrape competitor videos, analyze with AI, and generate scripts in one click
        </p>
      </div>

      {configs.length === 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-200">No configs available</p>
            <p className="text-xs text-muted-foreground mt-0.5">Create a config first to run the pipeline.</p>
          </div>
          <Link href="/configs">
            <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-xs h-8 glass border-white/[0.08]">
              Create Config
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* Config Selection */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-neon" />
          <h2 className="text-sm font-semibold">Pipeline Configuration</h2>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Select Config</Label>
          <Select value={selectedConfig} onValueChange={setSelectedConfig}>
            <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-11">
              <SelectValue placeholder="Choose a config..." />
            </SelectTrigger>
            <SelectContent>
              {configs.filter((c) => c.configName).map((c) => (
                <SelectItem key={c.id} value={c.configName}>{c.configName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Validation Preview */}
        {validating && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Validating config...</span>
          </div>
        )}

        {!validating && validation && validation.info.configName && (
          <div
            className={`rounded-xl border p-4 space-y-3 ${
              validation.valid
                ? "border-emerald-500/25 bg-emerald-500/5"
                : "border-red-500/25 bg-red-500/5"
            }`}
          >
            <div className="flex items-center gap-2">
              {validation.valid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <p className="text-sm font-medium">
                {validation.valid ? "Ready to run" : "Cannot run pipeline"}
              </p>
            </div>

            {validation.valid && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-foreground">{validation.info.creatorsCount} creators</p>
                    <p className="text-[10px] text-muted-foreground">to scrape</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Film className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-foreground">~{validation.info.estimatedVideos} videos</p>
                    <p className="text-[10px] text-muted-foreground">estimated</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-foreground">~{validation.info.estimatedMinutes}m</p>
                    <p className="text-[10px] text-muted-foreground">duration</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.08]">
                    {(validation.info.platforms || []).join(", ")}
                  </Badge>
                </div>
              </div>
            )}

            {validation.criticalErrors.length > 0 && (
              <div className="space-y-1">
                {validation.criticalErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                    <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{err}</span>
                  </p>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-1">
                {validation.warnings.map((warn, i) => (
                  <p key={i} className="text-xs text-amber-300 flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{warn}</span>
                  </p>
                ))}
              </div>
            )}

            {validation.valid && validation.info.creators && validation.info.creators.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Will scrape:</span>
                {validation.info.creators.slice(0, 5).map((c) => (
                  <Badge
                    key={c.username}
                    variant="secondary"
                    className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.08]"
                  >
                    @{c.username} · {c.platform}
                  </Badge>
                ))}
                {validation.info.creators.length > 5 && (
                  <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.08]">
                    +{validation.info.creators.length - 5} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Advanced settings */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
          Advanced settings
        </button>

        {showAdvanced && (
          <div className="grid gap-4 sm:grid-cols-3 animate-in fade-in slide-in-from-top-2 duration-200">
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
            <p className="text-xs font-semibold">Resume from saved videos</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Skip scraping — only generate scripts for already-analyzed videos
            </p>
          </div>
        </div>

        {/* Pipeline steps */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pipeline Steps</p>

          <ToggleStep
            checked={autoAnalysis}
            onChange={setAutoAnalysis}
            icon={Brain}
            label="Gemini Analysis"
            description="Upload each video to Gemini and analyze why it went viral"
            badge="costs API credits"
          />

          <ToggleStep
            checked={autoTranscript}
            onChange={setAutoTranscript}
            icon={AlignLeft}
            label="Auto Transcript"
            description="Extract word-for-word spoken transcript"
            badge="costs API credits"
          />

          <div className="border-t border-white/[0.06] pt-3 space-y-3">
            <ToggleStep
              checked={autoAnalysis && autoScripts}
              onChange={setAutoScripts}
              disabled={!autoAnalysis}
              icon={FileText}
              label="Auto-generate scripts"
              description="Write a full script for every analyzed video"
              warning={!autoAnalysis ? "requires Analysis" : undefined}
            />

            <ToggleStep
              checked={autoAnalysis && autoScripts && autoVideos}
              onChange={setAutoVideos}
              disabled={!autoAnalysis || !autoScripts}
              icon={Video}
              label="Auto-generate videos"
              description="Queue avatar video jobs (fal.ai required)"
              warning="not available — configure fal.ai in Settings"
            />
          </div>
        </div>

        <Button
          onClick={handleRun}
          disabled={running || !selectedConfig || (validation !== null && !validation.valid)}
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

        {validation && !validation.valid && validation.criticalErrors.some((e) => e.includes("creators")) && (
          <Link href="/creators">
            <Button variant="outline" className="w-full rounded-xl gap-2 glass border-white/[0.08]">
              <Settings className="h-4 w-4" />
              Manage Creators
            </Button>
          </Link>
        )}
      </div>

      {/* Progress */}
      {progress && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {progress.status === "running" && <Loader2 className="h-4 w-4 text-neon animate-spin" />}
                {progress.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {progress.status === "error" && <XCircle className="h-4 w-4 text-red-400" />}
                <h2 className="text-sm font-semibold">
                  {progress.status === "running" && progress.phase === "scraping" && "Phase 1 — Scraping..."}
                  {progress.status === "running" && progress.phase === "analyzing" && "Phase 2 — Analyzing..."}
                  {progress.status === "running" && progress.phase === "generating_scripts" && "Phase 3 — Writing scripts..."}
                  {progress.status === "completed" && "Pipeline complete"}
                  {progress.status === "error" && "Pipeline failed"}
                </h2>
              </div>
              <div className="text-xs text-muted-foreground">
                {progress.phase === "scraping" && (
                  <span>{progress.creatorsScraped}/{progress.creatorsTotal} creators</span>
                )}
                {progress.phase === "analyzing" && (
                  <span>{progress.videosAnalyzed}/{progress.videosTotal} videos</span>
                )}
                {progress.phase === "done" && (
                  <span className="text-emerald-400">
                    {progress.videosAnalyzed} analyzed · {progress.scriptsGenerated} scripts
                  </span>
                )}
              </div>
            </div>

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

            {progress.activeTasks.length > 0 && (
              <div className="space-y-2">
                {progress.activeTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.04] px-3 py-2">
                    <Loader2 className="h-3 w-3 text-neon animate-spin shrink-0" />
                    <span className="text-xs font-medium text-foreground/80">@{task.creator}</span>
                    <span className="text-[11px] text-muted-foreground">{task.step}</span>
                    {task.views !== undefined && (
                      <span className="ml-auto text-[11px] text-muted-foreground/60">
                        {formatViews(task.views)} views
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {progress.status === "completed" && (
              <div className="flex gap-2">
                {progress.scriptsGenerated > 0 && (
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

            {progress.errors.length > 0 && (
              <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-3 space-y-1">
                <p className="text-[11px] font-medium text-red-400">Errors ({progress.errors.length})</p>
                {progress.errors.map((err, i) => (
                  <p key={i} className="text-[11px] text-red-400/70 leading-relaxed">{err}</p>
                ))}
              </div>
            )}
          </div>

          {/* Live Log */}
          <details open={running} className="glass rounded-2xl overflow-hidden">
            <summary className="p-4 flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Terminal className="h-4 w-4 text-neon" />
              <span className="font-medium">Live Log</span>
              {running && <span className="ml-2 h-2 w-2 rounded-full bg-neon animate-pulse" />}
              <Badge variant="secondary" className="ml-auto rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
                {progress.log.length} entries
              </Badge>
            </summary>
            <div className="border-t border-white/[0.06] bg-black/40">
              <ScrollArea className="h-[350px] p-4">
                <div className="space-y-0.5 font-mono text-[11px]">
                  {progress.log.map((line, i) => (
                    <div
                      key={i}
                      className={`leading-5 ${
                        line.includes("✗") || line.includes("⚠") || line.includes("Error") || line.includes("error")
                          ? "text-red-400"
                          : line.includes("✓") || line.includes("Done") || line.includes("completed")
                          ? "text-emerald-400"
                          : line.includes("▶") || line.includes("Phase")
                          ? "text-neon"
                          : line.includes("Scraped") || line.includes("Analyzed")
                          ? "text-blue-300/80"
                          : "text-muted-foreground/80"
                      }`}
                    >
                      {line}
                    </div>
                  ))}
                  {running && (
                    <div className="flex items-center gap-1.5 text-muted-foreground/50 mt-1">
                      <span className="inline-block h-3 w-[2px] bg-neon animate-pulse" />
                      <span className="text-[10px]">waiting for next update...</span>
                    </div>
                  )}
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

interface ToggleStepProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  badge?: string;
  warning?: string;
}

function ToggleStep({ checked, onChange, disabled, icon: Icon, label, description, badge, warning }: ToggleStepProps) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer group ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className="h-5 w-9 rounded-full bg-white/[0.08] peer-checked:bg-neon transition-colors" />
        <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className="h-3 w-3 text-neon" />
          {label}
          {badge && (
            <span className="text-[10px] font-normal text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
              {badge}
            </span>
          )}
          {warning && (
            <span className="text-[10px] font-normal text-muted-foreground bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-0.5">
              {warning}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}
