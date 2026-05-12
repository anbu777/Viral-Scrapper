"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Play,
  Video,
  User,
  Clock,
  ExternalLink,
  Film,
  FileText,
  Clapperboard,
} from "lucide-react";
import type { Script, AvatarProfile } from "@/lib/types";

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

type FilterStatus = "all" | "awaiting_approval" | "approved" | "rejected" | "processing" | "failed";

const STATUS_LABELS: Record<FilterStatus, string> = {
  all: "All Videos",
  awaiting_approval: "Awaiting Review",
  approved: "Approved",
  rejected: "Rejected",
  processing: "Processing",
  failed: "Failed",
};

function StatusBadge({ status }: { status: Script["videoStatus"] }) {
  if (status === "processing") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">
      <Loader2 className="h-2.5 w-2.5 animate-spin" /> Generating…
    </span>
  );
  if (status === "awaiting_approval") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full">
      <Clock className="h-2.5 w-2.5" /> Awaiting Review
    </span>
  );
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="h-2.5 w-2.5" /> Approved
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
      <XCircle className="h-2.5 w-2.5" /> Rejected
    </span>
  );
  if (status === "failed") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400/70 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
      <XCircle className="h-2.5 w-2.5" /> Failed
    </span>
  );
  return null;
}

function VideoCard({
  script,
  avatars,
  onApprove,
  onReject,
  onRegenerate,
}: {
  script: Script;
  avatars: AvatarProfile[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRegenerate: (id: string) => void;
}) {
  const avatarName = avatars.find((a) => a.id === script.avatarId)?.name ?? script.avatarId ?? "—";
  const hasVideo = !!script.videoUrl;
  const isProcessing = script.videoStatus === "processing";
  const isAwaiting = script.videoStatus === "awaiting_approval";
  const isApproved = script.videoStatus === "approved";
  const isRejected = script.videoStatus === "rejected";
  const isFailed = script.videoStatus === "failed";

  return (
    <div className={`glass rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:border-white/[0.12]
      ${isAwaiting ? "border-yellow-500/30 shadow-[0_0_24px_rgba(234,179,8,0.05)]" : ""}
      ${isApproved ? "border-green-500/20" : ""}
      ${(isRejected || isFailed) ? "border-red-500/20 opacity-75" : ""}
    `}>

      {/* ── Video / Thumbnail preview area (9:16) ── */}
      <div className="relative bg-black/50" style={{ aspectRatio: "9/16" }}>
        {hasVideo ? (
          <video
            src={script.videoUrl}
            poster={script.generatedImageUrl ?? undefined}
            controls
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : script.generatedImageUrl ? (
          <img
            src={script.generatedImageUrl}
            alt={script.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground/20">
            <Clapperboard className="h-10 w-10" />
            <span className="text-xs">No preview yet</span>
          </div>
        )}

        {/* Generating overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 gap-3">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            <p className="text-xs text-blue-300 font-medium">Generating video…</p>
          </div>
        )}

        {/* Status pill — top left */}
        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={script.videoStatus} />
        </div>

        {/* Content type — top right */}
        {script.contentType && (
          <div className="absolute top-2.5 right-2.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-black/60 text-white/70 px-2 py-0.5 rounded-full backdrop-blur-sm">
              {script.contentType}
            </span>
          </div>
        )}
      </div>

      {/* ── Info + actions ── */}
      <div className="flex flex-col gap-3 p-4">
        {/* Title */}
        <div>
          <h3 className="text-sm font-semibold leading-tight line-clamp-2">{script.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground">
            {script.avatarId && (
              <span className="flex items-center gap-1">
                <User className="h-2.5 w-2.5 text-neon" />
                <span className="text-foreground/60">{avatarName}</span>
              </span>
            )}
            {script.estimatedDuration && (
              <span className="flex items-center gap-1">
                <Play className="h-2.5 w-2.5" />
                {script.estimatedDuration}
              </span>
            )}
          </div>
        </div>

        {/* Source video */}
        {script.videoCreator && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border-t border-white/[0.04] pt-2.5">
            <span>Source:</span>
            <span className="font-medium text-foreground/60">@{script.videoCreator}</span>
            <span className="ml-auto flex items-center gap-1">
              <Play className="h-2 w-2 fill-current" />
              {formatViews(script.videoViews)}
            </span>
            {script.videoLink && (
              <a href={script.videoLink} target="_blank" rel="noopener noreferrer"
                className="hover:text-neon transition-colors ml-0.5">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5 pt-0.5">
          {isAwaiting && (
            <>
              <Button
                size="sm"
                onClick={() => onApprove(script.id)}
                className="flex-1 h-8 rounded-xl text-[11px] bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 hover:border-green-500/50 gap-1 transition-all"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                onClick={() => onReject(script.id)}
                className="flex-1 h-8 rounded-xl text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 gap-1 transition-all"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRegenerate(script.id)}
                title="Regenerate"
                className="h-8 w-8 p-0 rounded-xl glass border-white/[0.06] text-muted-foreground/40 hover:text-blue-400 hover:border-blue-400/30 transition-all shrink-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </>
          )}

          {isApproved && (
            <>
              <div className="flex-1 flex items-center gap-1.5 text-[11px] text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Approved ✓</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRegenerate(script.id)}
                title="Regenerate a new version"
                className="h-8 rounded-xl text-[11px] glass border-white/[0.06] text-muted-foreground/40 hover:text-blue-400 gap-1.5 px-3 transition-all"
              >
                <RefreshCw className="h-3 w-3" />
                Regen
              </Button>
            </>
          )}

          {(isRejected || isFailed) && (
            <Button
              size="sm"
              onClick={() => onRegenerate(script.id)}
              className="flex-1 h-8 rounded-xl text-[11px] glass border-white/[0.08] text-muted-foreground hover:text-blue-400 hover:border-blue-400/30 gap-1.5 transition-all"
            >
              <RefreshCw className="h-3 w-3" />
              {isRejected ? "Regenerate" : "Retry"}
            </Button>
          )}

          {isProcessing && (
            <div className="flex-1 flex items-center gap-1.5 text-[11px] text-blue-400/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Generating…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeneratedPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [avatars, setAvatars] = useState<AvatarProfile[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadScripts = useCallback(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((data: Script[] | unknown) => {
        const all = Array.isArray(data) ? data : [];
        const generated = all.filter((s) => s.videoStatus && s.videoStatus !== "idle");
        setScripts(generated);
      })
      .catch(() => setScripts([]));
  }, []);

  useEffect(() => {
    loadScripts();
    fetch("/api/avatars")
      .then((r) => r.json())
      .then((d: unknown) => setAvatars(Array.isArray(d) ? d : []))
      .catch(() => setAvatars([]));

    // Poll every 12s to refresh processing → completed transitions automatically
    pollingRef.current = setInterval(loadScripts, 12_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [loadScripts]);

  const review = async (id: string, action: "approve" | "reject" | "regenerate") => {
    // Optimistic UI update
    setScripts((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      if (action === "approve") return { ...s, videoStatus: "approved" };
      if (action === "reject") return { ...s, videoStatus: "rejected" };
      return s; // regenerate handled below
    }));

    if (action === "regenerate") {
      // Remove from this page — status goes back to idle, user re-generates from Scripts page
      setScripts((prev) => prev.filter((s) => s.id !== id));
    }

    await fetch(`/api/scripts/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  };

  const visible = scripts
    .filter((s) => filterStatus === "all" || s.videoStatus === filterStatus)
    .sort((a, b) => {
      // Sort: awaiting first, then processing, then approved, rejected, failed
      const rank = (s: Script) => {
        if (s.videoStatus === "awaiting_approval") return 0;
        if (s.videoStatus === "processing") return 1;
        if (s.videoStatus === "approved") return 2;
        if (s.videoStatus === "rejected") return 3;
        return 4;
      };
      const d = rank(a) - rank(b);
      return d !== 0 ? d : (b.dateGenerated || "").localeCompare(a.dateGenerated || "");
    });

  const counts: Record<FilterStatus, number> = {
    all: scripts.length,
    awaiting_approval: scripts.filter((s) => s.videoStatus === "awaiting_approval").length,
    approved: scripts.filter((s) => s.videoStatus === "approved").length,
    rejected: scripts.filter((s) => s.videoStatus === "rejected").length,
    processing: scripts.filter((s) => s.videoStatus === "processing").length,
    failed: scripts.filter((s) => s.videoStatus === "failed").length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generated Videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and approve your AI-generated videos before posting
          </p>
        </div>
        {counts.awaiting_approval > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/25 px-4 py-2.5">
            <Clock className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-300">
              {counts.awaiting_approval} awaiting review
            </span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as FilterStatus[]).map((key) => {
          const count = counts[key];
          if (key !== "all" && count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium border transition-all ${
                filterStatus === key
                  ? "bg-white/[0.08] border-white/[0.15] text-foreground"
                  : "bg-transparent border-white/[0.05] text-muted-foreground hover:border-white/[0.10] hover:text-foreground"
              }`}
            >
              {STATUS_LABELS[key]}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                  key === "awaiting_approval" ? "bg-yellow-400/20 text-yellow-300" :
                  key === "approved" ? "bg-green-400/20 text-green-300" :
                  key === "rejected" || key === "failed" ? "bg-red-400/20 text-red-300" :
                  key === "processing" ? "bg-blue-400/20 text-blue-300" :
                  "bg-white/[0.08] text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {visible.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((script) => (
            <VideoCard
              key={script.id}
              script={script}
              avatars={avatars}
              onApprove={(id) => review(id, "approve")}
              onReject={(id) => review(id, "reject")}
              onRegenerate={(id) => review(id, "regenerate")}
            />
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-16 text-center">
          <Video className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
          <h3 className="font-semibold text-muted-foreground">
            {filterStatus === "all"
              ? "No generated videos yet"
              : `No ${STATUS_LABELS[filterStatus].toLowerCase()} videos`}
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground/60">
            {filterStatus === "all"
              ? "Generate a video from the Videos or Scripts page to see it here."
              : "Try a different filter above."}
          </p>
          {filterStatus === "all" && (
            <div className="mt-6 flex justify-center gap-3">
              <a href="/videos">
                <Button variant="outline" className="rounded-xl glass border-white/[0.08] text-muted-foreground hover:text-foreground gap-1.5 text-xs">
                  <Film className="h-3.5 w-3.5" />
                  Browse Videos
                </Button>
              </a>
              <a href="/scripts">
                <Button variant="outline" className="rounded-xl glass border-white/[0.08] text-muted-foreground hover:text-foreground gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  My Scripts
                </Button>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
