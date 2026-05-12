"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Heart, MessageCircle, Film, Search, Star, Play, ArrowUpDown,
  ExternalLink, Copy, Check, Video, Loader2, Send, CheckCircle2,
  XCircle, RefreshCw, User, FileText, Download, Square, CheckSquare,
} from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import type { Video as VideoType, Config, AvatarProfile, Script } from "@/lib/types";

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

type SortOption = "views" | "date-posted" | "date-added" | "starred";

type VideoGenState = {
  scriptId: string;
  status: Script["videoStatus"];
  videoUrl?: string;
  dateGenerated?: string;
};

export default function VideosPage() {
  return (
    <Suspense>
      <VideosContent />
    </Suspense>
  );
}

function VideosContent() {
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [filterConfig, setFilterConfig] = useState<string>("all");
  const [filterCreator, setFilterCreator] = useState<string>(searchParams.get("creator") || "all");
  const [sortBy, setSortBy] = useState<SortOption>("date-added");
  const [modalVideo, setModalVideo] = useState<VideoType | null>(null);
  const [copied, setCopied] = useState(false);

  // Avatar generation state
  const [avatars, setAvatars] = useState<AvatarProfile[]>([]);
  const [videoGens, setVideoGens] = useState<Record<string, VideoGenState>>({});
  const pollingRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Avatar picker modal
  const [pickerVideo, setPickerVideo] = useState<VideoType | null>(null);
  const [pickerAvatarId, setPickerAvatarId] = useState("");
  const [pickerDuration, setPickerDuration] = useState(10);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [lastError, setLastError] = useState<string | null>(null);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Per-video script generation
  const [scriptedVideoIds, setScriptedVideoIds] = useState<Set<string>>(new Set());
  const [scriptGenerating, setScriptGenerating] = useState<Set<string>>(new Set());

  // Per-card transcript state
  const [transcriptCopied, setTranscriptCopied] = useState<Set<string>>(new Set());
  const [transcriptLoading, setTranscriptLoading] = useState<Set<string>>(new Set());
  const [transcriptError, setTranscriptError] = useState<Record<string, string>>({});

  // Per-card analysis generation state
  const [analysisLoading, setAnalysisLoading] = useState<Set<string>>(new Set());
  const [analysisError, setAnalysisError] = useState<Record<string, string>>({});

  const copyTranscript = async (video: VideoType) => {
    const id = video.id || video.link;

    // Already cached on the video object
    if (video.transcript) {
      try { await navigator.clipboard.writeText(video.transcript); } catch { /* ignore */ }
      setTranscriptCopied((prev) => new Set(prev).add(id));
      setTimeout(() => setTranscriptCopied((prev) => { const s = new Set(prev); s.delete(id); return s; }), 2000);
      return;
    }

    setTranscriptLoading((prev) => new Set(prev).add(id));
    setTranscriptError((prev) => { const s = { ...prev }; delete s[id]; return s; });

    try {
      const res = await fetch(`/api/videos/${video.id}/transcript`, { method: "POST" });
      const data = await res.json().catch(() => ({ error: `Server error (HTTP ${res.status})` }));
      if (!res.ok) throw new Error(data.error ?? "Transcription failed");

      // Cache on video object so subsequent clicks are instant
      setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, transcript: data.transcript } : v));

      try { await navigator.clipboard.writeText(data.transcript); } catch { /* ignore */ }
      setTranscriptCopied((prev) => new Set(prev).add(id));
      setTimeout(() => setTranscriptCopied((prev) => { const s = new Set(prev); s.delete(id); return s; }), 2000);
    } catch (e) {
      setTranscriptError((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Failed" }));
      setTimeout(() => setTranscriptError((prev) => { const s = { ...prev }; delete s[id]; return s; }), 30000);
    } finally {
      setTranscriptLoading((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const generateAnalysis = async (video: VideoType) => {
    const id = video.id || video.link;

    setAnalysisLoading((prev) => new Set(prev).add(id));
    setAnalysisError((prev) => { const s = { ...prev }; delete s[id]; return s; });

    try {
      const res = await fetch(`/api/videos/${video.id}/analysis`, { method: "POST" });
      const data = await res.json().catch(() => ({ error: `Server error (HTTP ${res.status})` }));
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      const updatedVideo = { ...video, analysis: data.analysis };
      setVideos((prev) => prev.map((v) => v.id === video.id ? updatedVideo : v));
      setModalVideo(updatedVideo);
    } catch (e) {
      setAnalysisError((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Failed" }));
      setTimeout(() => setAnalysisError((prev) => { const s = { ...prev }; delete s[id]; return s; }), 30000);
    } finally {
      setAnalysisLoading((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const copyAnalysis = () => {
    if (!modalVideo) return;
    navigator.clipboard.writeText(modalVideo.analysis || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetch("/api/videos").then((r) => r.json()).then((d) => setVideos(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/configs").then((r) => r.json()).then((d) => setConfigs(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/avatars")
      .then((r) => r.json())
      .then((data: AvatarProfile[]) => {
        setAvatars(data);
        if (data.length > 0) setPickerAvatarId(data[0].id);
      });

    // Pre-load all scripts to restore status and track which videos already have scripts
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((scripts: Script[]) => {
        // Which videos already have a regular script
        const scripted = new Set(scripts.filter((s) => s.videoId && s.contentType !== "Video Clone").map((s) => s.videoId));
        setScriptedVideoIds(scripted);

        // Restore video clone generation states
        const clones = scripts.filter((s) => s.contentType === "Video Clone" && s.videoId);
        const map: Record<string, VideoGenState> = {};
        for (const s of clones) {
          const existing = map[s.videoId];
          if (!existing || (s.dateGenerated || "") > (existing.dateGenerated || "")) {
            map[s.videoId] = {
              scriptId: s.id,
              status: s.videoStatus,
              videoUrl: s.videoUrl,
              dateGenerated: s.dateGenerated,
            };
          }
        }
        setVideoGens(map);
      });

    return () => {
      pollingRefs.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  // Resume polling for any processing generations after state is loaded
  useEffect(() => {
    Object.entries(videoGens).forEach(([videoId, gen]) => {
      if (gen.status === "processing" && !pollingRefs.current.has(gen.scriptId)) {
        startPolling(gen.scriptId, videoId);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(videoGens).length]);

  const startPolling = (scriptId: string, videoId: string) => {
    if (pollingRefs.current.has(scriptId)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scripts/${scriptId}/video-status`);
        const data = await res.json();
        setVideoGens((prev) => ({
          ...prev,
          [videoId]: {
            ...prev[videoId],
            status: data.status,
            videoUrl: data.videoUrl,
          },
        }));
        if (data.status !== "processing") {
          clearInterval(interval);
          pollingRefs.current.delete(scriptId);
          setGenerating((prev) => { const s = new Set(prev); s.delete(videoId); return s; });
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 10_000);
    pollingRefs.current.set(scriptId, interval);
  };

  const generateScript = async (video: VideoType) => {
    const vid = video.id || video.link;
    setScriptGenerating((prev) => new Set(prev).add(vid));
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          videoAnalysis: video.analysis,
          videoCreator: video.creator,
          videoViews: video.views,
          videoLink: video.link,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLastError(data.error ?? "Script generation failed");
      } else {
        setScriptedVideoIds((prev) => new Set(prev).add(vid));
      }
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "Network error");
    } finally {
      setScriptGenerating((prev) => { const s = new Set(prev); s.delete(vid); return s; });
    }
  };

  const openPicker = (video: VideoType) => {
    setPickerVideo(video);
    const existingAvatarId = videoGens[video.id]
      ? avatars[0]?.id
      : avatars[0]?.id;
    setPickerAvatarId(existingAvatarId || "");
    setPickerDuration(10);
  };

  const confirmGenerate = async () => {
    if (!pickerVideo || !pickerAvatarId) return;
    const video = pickerVideo;
    setPickerVideo(null);
    setGenerating((prev) => new Set(prev).add(video.id));
    setLastError(null);

    // Optimistic update
    setVideoGens((prev) => ({
      ...prev,
      [video.id]: { scriptId: "", status: "processing" },
    }));

    try {
      const res = await fetch(`/api/videos/${video.id}/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: pickerAvatarId, duration: pickerDuration }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLastError(data.error ?? "Failed to start generation");
        setVideoGens((prev) => ({ ...prev, [video.id]: { scriptId: "", status: "failed" } }));
        setGenerating((prev) => { const s = new Set(prev); s.delete(video.id); return s; });
        return;
      }
      const { scriptId } = data as { scriptId: string };
      setVideoGens((prev) => ({
        ...prev,
        [video.id]: { scriptId, status: "processing", dateGenerated: new Date().toISOString() },
      }));
      startPolling(scriptId, video.id);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "Network error");
      setVideoGens((prev) => ({ ...prev, [video.id]: { scriptId: "", status: "failed" } }));
      setGenerating((prev) => { const s = new Set(prev); s.delete(video.id); return s; });
    }
  };

  const retryGeneration = (video: VideoType) => {
    openPicker(video);
  };

  const uniqueCreators = [...new Set(videos.map((v) => v.creator))].sort();

  const filtered = videos
    .filter((v) => {
      if (filterConfig !== "all" && v.configName !== filterConfig) return false;
      if (filterCreator !== "all" && v.creator !== filterCreator) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "starred") {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        return b.views - a.views;
      }
      if (sortBy === "views") return b.views - a.views;
      if (sortBy === "date-posted") return (b.datePosted || "").localeCompare(a.datePosted || "");
      if (sortBy === "date-added") return (b.dateAdded || "").localeCompare(a.dateAdded || "");
      return 0;
    });

  const toggleStar = async (id: string, currentStarred: boolean) => {
    const newStarred = !currentStarred;
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, starred: newStarred } : v)));
    await fetch("/api/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, starred: newStarred }),
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((v) => v.id || v.link)));
    }
  };

  const downloadAnalyses = () => {
    const selected = filtered.filter((v) => selectedIds.has(v.id || v.link));
    const lines: string[] = [`# Video Analyses\n\n_${selected.length} video${selected.length !== 1 ? "s" : ""} — exported ${new Date().toLocaleDateString()}_\n`];
    selected.forEach((video, i) => {
      lines.push(`\n---\n\n## ${i + 1}. @${video.creator} · ${formatViews(video.views)} views\n`);
      if (video.datePosted) lines.push(`**Posted:** ${video.datePosted}\n`);
      lines.push(`**Link:** ${video.link}\n`);
      lines.push(`\n${video.analysis || "_No analysis available._"}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-analyses-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Per-card generation status UI ─────────────────────────────────────────

  function VideoGenBadge({ videoId }: { videoId: string }) {
    const gen = videoGens[videoId];
    const isGenerating = generating.has(videoId);

    if (!gen && !isGenerating) return null;

    const status = gen?.status;

    if (isGenerating || status === "processing") {
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-blue-400 pt-0.5">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Generating avatar video…
        </div>
      );
    }
    if (status === "awaiting_approval") {
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 pt-0.5">
          <Send className="h-2.5 w-2.5" />
          Sent to Telegram
        </div>
      );
    }
    if (status === "approved") {
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-green-400 pt-0.5">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Approved ✓
        </div>
      );
    }
    if (status === "rejected" || status === "failed") {
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-red-400 pt-0.5">
          <XCircle className="h-2.5 w-2.5" />
          {status === "rejected" ? "Rejected" : "Failed"}
        </div>
      );
    }
    return null;
  }

  function VideoGenButton({ video }: { video: VideoType }) {
    const gen = videoGens[video.id];
    const isGenerating = generating.has(video.id);
    const status = gen?.status;

    if (isGenerating || status === "processing") {
      return (
        <Button
          variant="ghost"
          size="sm"
          disabled
          className="flex-1 rounded-xl text-[11px] h-7 gap-1 glass border-white/[0.06] text-blue-400"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating…
        </Button>
      );
    }

    if (status === "awaiting_approval" || status === "approved") {
      return (
        <div className="flex gap-1 flex-1">
          {gen?.videoUrl && (
            <a href={gen.videoUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-xl text-[11px] h-7 gap-1 glass border-white/[0.06] text-green-400 hover:text-green-300"
              >
                <Play className="h-3 w-3 fill-current" />
                Watch
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => retryGeneration(video)}
            className="h-7 w-7 p-0 rounded-xl text-muted-foreground/40 hover:text-blue-400"
            title="Regenerate"
          >
            <RefreshCw className="h-2.5 w-2.5" />
          </Button>
        </div>
      );
    }

    if (status === "rejected" || status === "failed") {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => retryGeneration(video)}
          className="flex-1 rounded-xl text-[11px] h-7 gap-1 glass border-white/[0.06] text-red-400 hover:text-red-300"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          Retry
        </Button>
      );
    }

    // Default: no generation yet
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openPicker(video)}
        className="flex-1 rounded-xl text-[11px] h-7 gap-1 glass border-white/[0.06] text-neon hover:text-neon hover:bg-neon/5"
      >
        <Video className="h-3 w-3" />
        Generate
      </Button>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Videos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse competitor reels — click Generate to clone any video with your AI avatar
        </p>
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

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterConfig} onValueChange={setFilterConfig}>
          <SelectTrigger className="w-[220px] rounded-xl glass border-white/[0.08] h-10">
            <SelectValue placeholder="Filter by config" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Configs</SelectItem>
            {configs.filter((c) => c.configName).map((c) => (
              <SelectItem key={c.id} value={c.configName}>{c.configName}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCreator} onValueChange={setFilterCreator}>
          <SelectTrigger className="w-[200px] rounded-xl glass border-white/[0.08] h-10">
            <SelectValue placeholder="Filter by creator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Creators</SelectItem>
            {uniqueCreators.filter(Boolean).map((c) => (
              <SelectItem key={c} value={c}>@{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[180px] rounded-xl glass border-white/[0.08] h-10">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-added">Most Recent</SelectItem>
            <SelectItem value="views">Most Views</SelectItem>
            <SelectItem value="date-posted">Date Posted</SelectItem>
            <SelectItem value="starred">Starred First</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs bg-white/[0.05] border border-white/[0.08]">
          {filtered.length} videos
        </Badge>
      </div>

      {/* Selection toolbar */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 -mt-4">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {selectedIds.size === filtered.length && filtered.length > 0
              ? <CheckSquare className="h-3.5 w-3.5 text-neon" />
              : <Square className="h-3.5 w-3.5" />}
            {selectedIds.size === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
          </button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
              <Button
                size="sm"
                onClick={downloadAnalyses}
                className="rounded-xl h-8 gap-1.5 text-xs bg-neon/15 hover:bg-neon/25 text-neon border border-neon/25 hover:border-neon/40"
                variant="ghost"
              >
                <Download className="h-3.5 w-3.5" />
                Download analyses (.md)
              </Button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* Video Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((video) => {
          const id = video.id || video.link;
          const isSelected = selectedIds.has(id);
          return (
            <div key={id} className="group">
              <div className={`glass rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/[0.12] ${isSelected ? "ring-2 ring-neon/50 border-neon/30" : ""}`}>
                {/* Thumbnail */}
                <div className="relative block aspect-[9/16] w-full bg-white/[0.02] overflow-hidden">
                  {/* Select checkbox overlay */}
                  <button
                    onClick={() => toggleSelect(id)}
                    className={`absolute top-2 left-2 z-10 h-6 w-6 rounded-md flex items-center justify-center transition-all duration-150 ${
                      isSelected
                        ? "bg-neon border border-neon"
                        : "bg-black/40 border border-white/20 opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                  <a
                  href={video.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-full w-full"
                >
                  {video.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail.startsWith("/") ? video.thumbnail : `/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}`}
                      alt={`@${video.creator}`}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-10 w-10 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-8 pb-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <Play className="h-4 w-4 text-white fill-white" />
                      <span className="text-[15px] font-bold text-white">{formatViews(video.views)}</span>
                    </div>
                  </div>
                </a>
                </div>

                {/* Info bar */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate">@{video.creator}</p>
                    <button
                      onClick={() => toggleStar(id, video.starred)}
                      className="shrink-0 ml-1.5 transition-colors"
                    >
                      <Star className={`h-4 w-4 ${video.starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400/60"}`} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatViews(video.likes)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {formatViews(video.comments)}
                    </span>
                    <span className="ml-auto text-[10px]">{video.datePosted}</span>
                  </div>

                  <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06] text-muted-foreground">
                    {video.configName}
                  </Badge>

                  {/* Generation status */}
                  <VideoGenBadge videoId={id} />

                  {/* Transcript / analysis error display */}
                  {(transcriptError[id] || analysisError[id]) && (
                    <p className="text-[10px] text-red-400 leading-snug break-words rounded-lg bg-red-500/10 px-2 py-1">
                      {transcriptError[id] || analysisError[id]}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => video.analysis ? setModalVideo(video) : generateAnalysis(video)}
                      disabled={analysisLoading.has(id)}
                      className={`rounded-xl text-[11px] h-7 gap-1 transition-all duration-200 glass border-white/[0.06] px-2 ${
                        analysisError[id] ? "text-red-400" :
                        analysisLoading.has(id) ? "text-blue-400" :
                        "text-muted-foreground hover:text-foreground"
                      }`}
                      title={analysisError[id] || (video.analysis ? "View analysis" : "Generate analysis")}
                    >
                      {analysisLoading.has(id) ? <Loader2 className="h-3 w-3 animate-spin" /> :
                       analysisError[id] ? <XCircle className="h-3 w-3" /> :
                       <Search className="h-3 w-3" />}
                      {analysisLoading.has(id) ? "Analyzing…" :
                       analysisError[id] ? "Error" :
                       "Analysis"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyTranscript(video)}
                      disabled={transcriptLoading.has(id)}
                      className={`rounded-xl text-[11px] h-7 gap-1 transition-all duration-200 glass border-white/[0.06] px-2 ${
                        transcriptCopied.has(id) ? "text-green-400" :
                        transcriptError[id] ? "text-red-400" :
                        transcriptLoading.has(id) ? "text-blue-400" :
                        "text-muted-foreground hover:text-foreground"
                      }`}
                      title={transcriptError[id] || "Copy raw spoken transcript"}
                    >
                      {transcriptCopied.has(id) ? <Check className="h-3 w-3" /> :
                       transcriptLoading.has(id) ? <Loader2 className="h-3 w-3 animate-spin" /> :
                       <Copy className="h-3 w-3" />}
                      {transcriptCopied.has(id) ? "Copied!" :
                       transcriptError[id] ? "Error" :
                       transcriptLoading.has(id) ? "Fetching…" :
                       "Transcript"}
                    </Button>
                    {scriptedVideoIds.has(id) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="rounded-xl text-[11px] h-7 gap-1 glass border-white/[0.06] text-green-400 px-2"
                      >
                        <Check className="h-3 w-3" />
                        Scripted
                      </Button>
                    ) : scriptGenerating.has(id) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="rounded-xl text-[11px] h-7 gap-1 glass border-white/[0.06] text-blue-400 px-2"
                      >
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Scripting…
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => generateScript(video)}
                        className="rounded-xl text-[11px] h-7 gap-1 glass border-white/[0.06] text-neon hover:text-neon px-2"
                      >
                        <FileText className="h-3 w-3" />
                        Script
                      </Button>
                    )}
                    <VideoGenButton video={video} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <Film className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-4 font-semibold">No videos found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Run a pipeline analysis to generate results, or adjust your filters.
          </p>
        </div>
      )}

      {/* Analysis Modal */}
      <Dialog open={!!modalVideo} onOpenChange={(open) => { if (!open) { setModalVideo(null); setCopied(false); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden glass-strong rounded-2xl border-white/[0.08] shadow-xl p-0 gap-0">
          <DialogTitle className="sr-only">Video Analysis</DialogTitle>
          {modalVideo && (
            <>
              <div className="flex items-center gap-4 p-5 border-b border-white/[0.06]">
                <div className="relative h-16 w-12 shrink-0 rounded-lg overflow-hidden bg-white/[0.02]">
                  {modalVideo.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={modalVideo.thumbnail.startsWith("/") ? modalVideo.thumbnail : `/api/proxy-image?url=${encodeURIComponent(modalVideo.thumbnail)}`}
                      alt={`@${modalVideo.creator}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Film className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">@{modalVideo.creator}</p>
                    <a href={modalVideo.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-neon transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Play className="h-3 w-3 fill-current" />
                      {formatViews(modalVideo.views)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatViews(modalVideo.likes)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {formatViews(modalVideo.comments)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAnalysis}
                    className="rounded-xl text-xs h-8 gap-1.5 glass border-white/[0.06] text-muted-foreground hover:text-foreground"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6">
                <MarkdownContent content={modalVideo.analysis} variant="analysis" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Avatar Picker Modal */}
      <Dialog open={!!pickerVideo} onOpenChange={(open) => { if (!open) setPickerVideo(null); }}>
        <DialogContent className="max-w-sm glass-strong rounded-2xl border-white/[0.08] p-6 gap-0">
          <DialogTitle className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Video className="h-4 w-4 text-neon" />
            Clone this video
          </DialogTitle>
          {pickerVideo && (
            <p className="text-[11px] text-muted-foreground mb-4">
              @{pickerVideo.creator} · {formatViews(pickerVideo.views)} views
              {pickerVideo.duration ? ` · ${pickerVideo.duration}s original` : ""}
            </p>
          )}

          {avatars.length === 0 ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-xs text-muted-foreground">No avatars found. Create one first.</p>
              <a href="/avatars">
                <Button className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 text-xs gap-1.5 font-semibold">
                  <User className="h-3 w-3" />
                  Go to Avatars
                </Button>
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Avatar selection */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Choose Avatar</p>
                {avatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setPickerAvatarId(avatar.id)}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all text-left ${
                      pickerAvatarId === avatar.id
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
                    {pickerAvatarId === avatar.id && (
                      <CheckCircle2 className="h-4 w-4 text-neon shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Video Duration</p>
                <div className="flex gap-2">
                  {[5, 10, 15].map((d) => (
                    <button
                      key={d}
                      onClick={() => setPickerDuration(d)}
                      className={`flex-1 rounded-xl py-2 text-xs border transition-all ${
                        pickerDuration === d
                          ? "bg-neon/15 border-neon/40 text-neon"
                          : "glass border-white/[0.06] text-muted-foreground hover:border-white/[0.12]"
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                  {pickerVideo?.duration && (
                    <button
                      onClick={() => setPickerDuration(pickerVideo.duration!)}
                      className={`flex-1 rounded-xl py-2 text-xs border transition-all leading-tight ${
                        pickerDuration === pickerVideo.duration
                          ? "bg-neon/15 border-neon/40 text-neon"
                          : "glass border-white/[0.06] text-muted-foreground hover:border-white/[0.12]"
                      }`}
                    >
                      Exact<br />
                      <span className="text-[10px] opacity-70">{pickerVideo.duration}s</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={confirmGenerate}
                  disabled={!pickerAvatarId}
                  className="flex-1 rounded-xl bg-neon text-black hover:bg-neon/90 border-0 font-semibold gap-2 text-xs"
                >
                  <Video className="h-3.5 w-3.5" />
                  Generate
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setPickerVideo(null)}
                  className="rounded-xl glass border-white/[0.06] text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
