"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  FileText,
  Copy,
  Trash2,
  ExternalLink,
  Play,
  ArrowUpDown,
  Sparkles,
  Video,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  User,
} from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import type { Script, AvatarProfile } from "@/lib/types";

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

type SortOption = "date" | "views" | "starred";

type VideoStatusData = {
  status: Script["videoStatus"];
  videoUrl?: string;
  geminiCheck?: string;
  claudeCheck?: string;
};

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [filterType, setFilterType] = useState("all");
  const [modalScript, setModalScript] = useState<Script | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [retryingAll, setRetryingAll] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const pollingRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Avatar picker
  const [avatars, setAvatars] = useState<AvatarProfile[]>([]);
  const [pickerScript, setPickerScript] = useState<Script | null>(null); // script waiting for avatar pick
  const [pickerSelectedAvatar, setPickerSelectedAvatar] = useState<string>("");

  const loadScripts = () => {
    fetch("/api/scripts").then((r) => r.json()).then((d) => setScripts(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => {
    loadScripts();
    fetch("/api/avatars")
      .then((r) => r.json())
      .then((data: AvatarProfile[]) => {
        setAvatars(data);
        if (data.length > 0) setPickerSelectedAvatar(data[0].id);
      });
    return () => {
      pollingRefs.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  // Resume polling for any scripts that are still processing on page load
  useEffect(() => {
    scripts.forEach((s) => {
      if (s.videoStatus === "processing" && !pollingRefs.current.has(s.id)) {
        startPolling(s.id);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scripts.length]);

  const uniqueTypes = [...new Set(scripts.map((s) => s.contentType).filter(Boolean))].sort();

  const filtered = scripts
    .filter((s) => filterType === "all" || s.contentType === filterType)
    .sort((a, b) => {
      if (sortBy === "starred") {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
      }
      if (sortBy === "views") return b.videoViews - a.videoViews;
      return (b.dateGenerated || "").localeCompare(a.dateGenerated || "");
    });

  const toggleStar = async (id: string, current: boolean) => {
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, starred: !current } : s)));
    await fetch("/api/scripts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, starred: !current }),
    });
  };

  const deleteScript = async (id: string) => {
    if (!confirm("Delete this script?")) return;
    stopPolling(id);
    await fetch(`/api/scripts?id=${id}`, { method: "DELETE" });
    loadScripts();
  };

  const copyScript = async () => {
    if (!modalScript) return;
    await navigator.clipboard.writeText(modalScript.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Video Generation ───────────────────────────────────────────────────────

  const updateScriptLocally = (id: string, updates: Partial<Script>) => {
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    setModalScript((prev) => (prev?.id === id ? { ...prev, ...updates } : prev));
  };

  const startPolling = (id: string) => {
    if (pollingRefs.current.has(id)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scripts/${id}/video-status`);
        const data: VideoStatusData = await res.json();
        updateScriptLocally(id, {
          videoStatus: data.status,
          videoUrl: data.videoUrl,
          geminiCheck: data.geminiCheck,
          claudeCheck: data.claudeCheck,
        });
        if (data.status !== "processing") {
          stopPolling(id);
          setGeneratingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 10_000);
    pollingRefs.current.set(id, interval);
  };

  const stopPolling = (id: string) => {
    const interval = pollingRefs.current.get(id);
    if (interval) {
      clearInterval(interval);
      pollingRefs.current.delete(id);
    }
  };

  const generateVideo = async (script: Script, avatarId?: string) => {
    setGeneratingIds((prev) => new Set(prev).add(script.id));
    updateScriptLocally(script.id, { videoStatus: "processing", avatarId: avatarId || script.avatarId });
    setLastError(null);

    try {
      const res = await fetch(`/api/scripts/${script.id}/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: avatarId || script.avatarId }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        // Route returned HTML — likely a server compile error or crash
        const html = await res.text();
        const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
        const errMsg = `Server error (HTTP ${res.status}): ${match?.[1]?.slice(0, 300) ?? "Route returned HTML — check terminal for compile errors"}`;
        updateScriptLocally(script.id, { videoStatus: "failed" });
        setGeneratingIds((prev) => { const s = new Set(prev); s.delete(script.id); return s; });
        setLastError(errMsg);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error ?? "Failed to start video generation";
        updateScriptLocally(script.id, { videoStatus: "failed" });
        setGeneratingIds((prev) => { const s = new Set(prev); s.delete(script.id); return s; });
        setLastError(errMsg);
        return;
      }
      startPolling(script.id);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Network error";
      updateScriptLocally(script.id, { videoStatus: "failed" });
      setGeneratingIds((prev) => { const s = new Set(prev); s.delete(script.id); return s; });
      setLastError(errMsg);
    }
  };

  const retryAllFailed = async () => {
    const failed = scripts.filter((s) => s.videoStatus === "failed" || !s.videoStatus || s.videoStatus === "idle");
    if (failed.length === 0) return;
    setRetryingAll(true);
    setLastError(null);
    for (const script of failed) {
      await generateVideo({ ...script, videoStatus: "idle", videoJobId: undefined, videoUrl: undefined });
      // Small delay between jobs to avoid hammering APIs simultaneously
      await new Promise((r) => setTimeout(r, 2000));
    }
    setRetryingAll(false);
  };

  const retryVideo = (script: Script) => {
    updateScriptLocally(script.id, {
      videoStatus: "idle",
      videoJobId: undefined,
      videoUrl: undefined,
      geminiCheck: undefined,
      claudeCheck: undefined,
    });
    setPickerScript({ ...script, videoStatus: "idle" });
    setPickerSelectedAvatar(script.avatarId || avatars[0]?.id || "");
  };

  const openVideoPicker = (script: Script) => {
    setPickerScript(script);
    setPickerSelectedAvatar(script.avatarId || avatars[0]?.id || "");
  };

  const confirmPickerAndGenerate = () => {
    if (!pickerScript) return;
    generateVideo(pickerScript, pickerSelectedAvatar);
    setPickerScript(null);
  };

  // ─── Video Status UI ────────────────────────────────────────────────────────

  function VideoStatusBadge({ script }: { script: Script }) {
    const status = script.videoStatus;
    if (!status || status === "idle") return null;

    if (status === "processing") {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating video…
        </div>
      );
    }
    if (status === "awaiting_approval") {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-yellow-400">
          <Send className="h-3 w-3" />
          Sent to Telegram for approval
        </div>
      );
    }
    if (status === "approved") {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Approved
        </div>
      );
    }
    if (status === "rejected") {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400">
          <XCircle className="h-3 w-3" />
          Rejected
        </div>
      );
    }
    if (status === "failed") {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400">
          <XCircle className="h-3 w-3" />
          Generation failed
        </div>
      );
    }
    return null;
  }

  function VideoActions({ script }: { script: Script }) {
    const status = script.videoStatus;
    const isGenerating = generatingIds.has(script.id);

    if (isGenerating || status === "processing") {
      return (
        <Button
          variant="ghost"
          size="sm"
          disabled
          className="flex-1 rounded-xl text-[11px] h-8 gap-1 glass border-white/[0.06] text-blue-400"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating…
        </Button>
      );
    }

    if (status === "awaiting_approval" || status === "approved") {
      return (
        <div className="flex gap-1.5 flex-1">
          {script.videoUrl && (
            <a href={script.videoUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-xl text-[11px] h-8 gap-1 glass border-white/[0.06] text-green-400 hover:text-green-300"
              >
                <Play className="h-3 w-3 fill-current" />
                Watch Video
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => retryVideo(script)}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground/40 hover:text-blue-400"
            title="Regenerate"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    if (status === "rejected" || status === "failed") {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => retryVideo(script)}
          className="flex-1 rounded-xl text-[11px] h-8 gap-1 glass border-white/[0.06] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          {status === "rejected" ? "Regenerate" : "Retry"}
        </Button>
      );
    }

    // Default: no video yet
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openVideoPicker(script)}
        className="flex-1 rounded-xl text-[11px] h-8 gap-1 glass border-white/[0.06] text-neon hover:text-neon"
      >
        <Video className="h-3 w-3" />
        Generate Video
      </Button>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Scripts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated scripts personalized to your voice, ready for HeyGen
          </p>
        </div>
        <div className="flex items-center gap-2">
          {scripts.some((s) => s.videoStatus === "failed" || !s.videoStatus || s.videoStatus === "idle") && (
            <Button
              variant="outline"
              onClick={retryAllFailed}
              disabled={retryingAll}
              className="rounded-xl gap-1.5 glass border-amber-500/30 text-amber-400 hover:text-amber-300 hover:border-amber-500/50"
            >
              {retryingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {retryingAll ? "Retrying…" : `Retry All (${scripts.filter(s => s.videoStatus === "failed" || !s.videoStatus || s.videoStatus === "idle").length})`}
            </Button>
          )}
          <a href="/voice-profile">
            <Button variant="outline" className="rounded-xl gap-1.5 glass border-white/[0.08] text-muted-foreground hover:text-foreground">
              <User className="h-3.5 w-3.5" />
              Avatar Profiles
            </Button>
          </a>
        </div>
      </div>

      {/* Error banner */}
      {lastError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300 leading-relaxed font-mono">{lastError}</p>
          </div>
          <button onClick={() => setLastError(null)} className="text-red-400/50 hover:text-red-400 text-xs shrink-0">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px] rounded-xl glass border-white/[0.08] h-10">
            <SelectValue placeholder="Content Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {uniqueTypes.filter(Boolean).map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[180px] rounded-xl glass border-white/[0.08] h-10">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Most Recent</SelectItem>
            <SelectItem value="views">Source Video Views</SelectItem>
            <SelectItem value="starred">Starred First</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs bg-white/[0.05] border border-white/[0.08]">
          {filtered.length} scripts
        </Badge>
      </div>

      {/* Scripts Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((script) => (
            <div key={script.id} className="glass rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-200 flex flex-col gap-4">
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold leading-tight line-clamp-2">{script.title}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {script.contentType && (
                      <Badge variant="secondary" className="rounded-md text-[10px] bg-neon/10 text-neon border border-neon/20">
                        {script.contentType}
                      </Badge>
                    )}
                    {script.estimatedDuration && (
                      <span className="flex items-center gap-1">
                        <Play className="h-2.5 w-2.5" />
                        {script.estimatedDuration}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => toggleStar(script.id, script.starred)} className="shrink-0">
                  <Star className={`h-4 w-4 transition-colors ${script.starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400/60"}`} />
                </button>
              </div>

              {/* Hook preview */}
              {script.hook && (
                <div className="rounded-xl bg-black/20 border border-white/[0.04] p-3">
                  <p className="text-[10px] font-semibold text-neon uppercase tracking-wider mb-1">Hook</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic">
                    &ldquo;{script.hook}&rdquo;
                  </p>
                </div>
              )}

              {/* Video status badge */}
              <VideoStatusBadge script={script} />

              {/* AI check results (shown when video is sent/approved) */}
              {(script.geminiCheck || script.claudeCheck) && (
                <div className="rounded-xl bg-black/20 border border-white/[0.04] p-3 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">AI Consistency Check</p>
                  {script.geminiCheck && (
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      <span className="text-foreground/50">Gemini:</span> {script.geminiCheck}
                    </p>
                  )}
                  {script.claudeCheck && (
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      <span className="text-foreground/50">Claude:</span> {script.claudeCheck}
                    </p>
                  )}
                </div>
              )}

              {/* Avatar badge */}
              {script.avatarId && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <User className="h-3 w-3 text-neon" />
                  <span className="text-foreground/60">
                    {avatars.find((a) => a.id === script.avatarId)?.name ?? script.avatarId}
                  </span>
                </div>
              )}

              {/* Source video info */}
              {script.videoCreator && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Source:</span>
                  <span className="font-medium text-foreground/70">@{script.videoCreator}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <Play className="h-2.5 w-2.5 fill-current" />
                    {formatViews(script.videoViews)}
                  </span>
                  {script.videoLink && (
                    <a href={script.videoLink} target="_blank" rel="noopener noreferrer" className="hover:text-neon transition-colors">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-1.5 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalScript(script)}
                  className="rounded-xl text-[11px] h-8 gap-1 glass border-white/[0.06] text-muted-foreground hover:text-foreground px-3"
                >
                  <FileText className="h-3 w-3" />
                  Script
                </Button>
                <VideoActions script={script} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteScript(script.id)}
                  className="h-8 w-8 p-0 rounded-xl text-muted-foreground/40 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-4 font-semibold">No scripts yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Go to the Videos page, open any analyzed video, and click &ldquo;Generate My Script&rdquo;.
          </p>
          <a href="/videos">
            <Button className="mt-6 rounded-xl bg-neon text-black hover:bg-neon/90 border-0 font-semibold">
              Browse Videos
            </Button>
          </a>
        </div>
      )}

      {/* Avatar Picker Modal */}
      <Dialog open={!!pickerScript} onOpenChange={(open) => { if (!open) setPickerScript(null); }}>
        <DialogContent className="max-w-sm glass-strong rounded-2xl border-white/[0.08] p-6 gap-0">
          <DialogTitle className="text-sm font-semibold mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-neon" />
            Choose Avatar
          </DialogTitle>
          {avatars.length === 0 ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-xs text-muted-foreground">No avatars found. Create one first.</p>
              <a href="/voice-profile">
                <Button className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 text-xs gap-1.5 font-semibold">
                  <User className="h-3 w-3" />
                  Go to Avatar Profiles
                </Button>
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {avatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setPickerSelectedAvatar(avatar.id)}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all text-left ${
                      pickerSelectedAvatar === avatar.id
                        ? "bg-neon/15 border-neon/40"
                        : "glass border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-neon/15 to-emerald-500/15 border border-white/[0.08] flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-neon" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{avatar.name}</p>
                      {avatar.niche && <p className="text-[10px] text-muted-foreground mt-0.5">{avatar.niche}</p>}
                    </div>
                    {pickerSelectedAvatar === avatar.id && (
                      <CheckCircle2 className="h-4 w-4 text-neon shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={confirmPickerAndGenerate}
                  disabled={!pickerSelectedAvatar}
                  className="flex-1 rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 text-xs font-semibold"
                >
                  <Video className="h-3.5 w-3.5" />
                  Generate Video
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setPickerScript(null)}
                  className="rounded-xl glass border-white/[0.06] text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Script Modal */}
      <Dialog open={!!modalScript} onOpenChange={(open) => { if (!open) setModalScript(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden glass-strong rounded-2xl border-white/[0.08] p-0 gap-0">
          <DialogTitle className="sr-only">Script: {modalScript?.title}</DialogTitle>
          {modalScript && (
            <>
              {/* Modal header */}
              <div className="flex items-start gap-4 p-5 border-b border-white/[0.06]">
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold leading-snug">{modalScript.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {modalScript.contentType && (
                      <Badge variant="secondary" className="rounded-md text-[10px] bg-neon/10 text-neon border border-neon/20">
                        {modalScript.contentType}
                      </Badge>
                    )}
                    {modalScript.estimatedDuration && <span>{modalScript.estimatedDuration}</span>}
                    {modalScript.videoCreator && (
                      <span>Based on @{modalScript.videoCreator} ({formatViews(modalScript.videoViews)} views)</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyScript}
                  className="shrink-0 rounded-xl h-8 gap-1.5 text-xs glass border-white/[0.06] text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>

              {/* Script body */}
              <div className="overflow-y-auto max-h-[calc(90vh-90px)] p-6">
                <MarkdownContent content={modalScript.script} variant="analysis" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
