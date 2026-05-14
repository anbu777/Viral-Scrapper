"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Flame,
  Loader2,
  CheckCircle2,
  X,
  Play,
  Eye,
  Heart,
  Search,
  Sparkles,
  Settings,
  Instagram,
  Music2,
  Youtube,
  Power,
  PowerOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VideoThumbnail } from "@/components/avatar-placeholder";
import type { ViralAlert, Video } from "@/lib/types";

interface AlertWithVideo extends ViralAlert {
  video: Video | null;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "tiktok") return <Music2 className={className} />;
  if (platform === "youtube_shorts") return <Youtube className={className} />;
  return <Instagram className={className} />;
}

export default function ViralAlertsPage() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertWithVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unseen" | "instagram" | "tiktok" | "youtube_shorts">("all");
  const [running, setRunning] = useState(false);
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean | null>(null);
  const [togglingScheduler, setTogglingScheduler] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [alertsRes, schedulerRes] = await Promise.all([
        fetch("/api/scheduler/alerts"),
        fetch("/api/scheduler"),
      ]);
      const data = (await alertsRes.json()) as AlertWithVideo[];
      setAlerts(Array.isArray(data) ? data : []);
      const schedulerData = await schedulerRes.json() as { status?: { enabledJobs?: number; totalJobs?: number } };
      const totalJobs = schedulerData.status?.totalJobs ?? 0;
      const enabledJobs = schedulerData.status?.enabledJobs ?? 0;
      setSchedulerEnabled(totalJobs === 0 ? false : enabledJobs > 0);
    } finally {
      setLoading(false);
    }
  };

  const toggleScheduler = async () => {
    setTogglingScheduler(true);
    try {
      const newEnabled = !schedulerEnabled;
      const res = await fetch("/api/scheduler", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle scheduler");
      setSchedulerEnabled(newEnabled);
      toast.success(
        newEnabled ? "Auto-scraping enabled" : "Auto-scraping disabled",
        newEnabled
          ? "Scheduler will check creators on their configured intervals"
          : "Scheduler paused — use Check Now for manual checks"
      );
    } catch {
      toast.error("Failed to toggle scheduler");
    } finally {
      setTogglingScheduler(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const dismiss = async (id: string) => {
    await fetch("/api/scheduler/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, dismissed: true }),
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const markSeen = async (id: string) => {
    await fetch("/api/scheduler/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, seen: true }),
    });
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, seen: true } : a)));
  };

  const markAllSeen = async () => {
    await fetch("/api/scheduler/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markAllSeen" }),
    });
    toast.success("All alerts marked as seen");
    load();
  };

  const triggerTick = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/scheduler", { method: "POST" });
      const data = (await res.json()) as { processed: number; alerts: number };
      toast.success(
        "Scheduler tick complete",
        `Checked ${data.processed} creator${data.processed !== 1 ? "s" : ""}, found ${data.alerts} new viral video${data.alerts !== 1 ? "s" : ""}`
      );
      load();
    } catch {
      toast.error("Failed to trigger scheduler");
    } finally {
      setRunning(false);
    }
  };

  const filtered = alerts.filter((a) => {
    if (filter === "all") return true;
    if (filter === "unseen") return !a.seen;
    return a.platform === filter;
  });

  const unseenCount = alerts.filter((a) => !a.seen).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Flame className="h-8 w-8 text-amber-400" />
            Viral Alerts
            {unseenCount > 0 && (
              <Badge className="rounded-full bg-amber-500/15 border-amber-500/25 text-amber-400 text-xs">
                {unseenCount} new
              </Badge>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-detected viral content from your tracked creators
          </p>
        </div>
        <div className="flex gap-2">
          {/* Scheduler enable/disable toggle */}
          <Button
            onClick={toggleScheduler}
            disabled={togglingScheduler || schedulerEnabled === null}
            variant="ghost"
            className={`rounded-xl glass border-white/[0.08] gap-1.5 ${
              schedulerEnabled
                ? "border-neon/25 bg-neon/5 text-neon"
                : "text-muted-foreground"
            }`}
          >
            {togglingScheduler ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : schedulerEnabled ? (
              <Power className="h-3.5 w-3.5" />
            ) : (
              <PowerOff className="h-3.5 w-3.5" />
            )}
            {schedulerEnabled === null
              ? "Loading…"
              : schedulerEnabled
                ? "Auto-Scraping ON"
                : "Auto-Scraping OFF"}
          </Button>
          <Button
            onClick={triggerTick}
            disabled={running}
            variant="ghost"
            className="rounded-xl glass border-white/[0.08] gap-1.5"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Check Now
          </Button>
          {unseenCount > 0 && (
            <Button onClick={markAllSeen} variant="ghost" className="rounded-xl glass border-white/[0.08] gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark all seen
            </Button>
          )}
          <Link href="/settings">
            <Button variant="ghost" className="rounded-xl glass border-white/[0.08] gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Configure
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[200px] rounded-xl glass border-white/[0.08] h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Alerts</SelectItem>
            <SelectItem value="unseen">Unseen Only</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs bg-white/[0.05] border border-white/[0.08]">
          {filtered.length} alerts
        </Badge>
      </div>

      {/* Alert Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Flame className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-4 font-semibold">No viral alerts yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {schedulerEnabled
              ? "Auto-scraping is active. Alerts will appear here when tracked creators post viral content."
              : "Enable auto-scraping to automatically detect viral content, or use Check Now for a manual check."}
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <Button
              onClick={toggleScheduler}
              disabled={togglingScheduler}
              className={`rounded-xl border-0 gap-2 font-semibold ${
                schedulerEnabled
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-neon text-black hover:bg-neon/90"
              }`}
            >
              {schedulerEnabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              {schedulerEnabled ? "Disable Auto-Scraping" : "Enable Auto-Scraping"}
            </Button>
            <Button onClick={triggerTick} variant="outline" className="rounded-xl gap-2 glass border-white/[0.08]">
              <Sparkles className="h-4 w-4" />
              Check Now
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={`glass rounded-2xl p-5 transition-all ${
                !alert.seen ? "border-amber-500/25 bg-amber-500/5" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <div className="shrink-0 h-24 w-16 rounded-xl overflow-hidden bg-white/[0.05]">
                  <VideoThumbnail
                    src={alert.video?.thumbnail}
                    creator={alert.creatorUsername}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!alert.seen && (
                      <Badge className="rounded-md text-[10px] bg-amber-500/15 border-amber-500/25 text-amber-400">
                        🔥 NEW
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.08]"
                    >
                      <PlatformIcon platform={alert.platform} className="h-2.5 w-2.5 mr-1" />
                      {alert.platform === "youtube_shorts" ? "YouTube" : alert.platform}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatRelative(alert.createdAt)}</span>
                  </div>

                  <h3 className="mt-1.5 text-sm font-semibold truncate">
                    @{alert.creatorUsername}
                  </h3>

                  {alert.video?.caption && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {alert.video.caption}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                      <Flame className="h-3 w-3" />
                      {alert.thresholdUsed.toFixed(1)}× baseline
                    </div>
                    {alert.video?.views !== undefined && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {formatViews(alert.video.views)}
                      </div>
                    )}
                    {alert.video?.likes !== undefined && alert.video.likes > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Heart className="h-3 w-3" />
                        {formatViews(alert.video.likes)}
                      </div>
                    )}
                    <span className="text-muted-foreground/60">·</span>
                    <span className="text-muted-foreground/80">
                      Score: {alert.viralityScore.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  {alert.video?.link && (
                    <a href={alert.video.link} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg h-8 gap-1.5 text-xs glass border border-white/[0.06] w-full"
                      >
                        <Play className="h-3 w-3" />
                        Watch
                      </Button>
                    </a>
                  )}
                  <Link href="/videos">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg h-8 gap-1.5 text-xs glass border border-white/[0.06] w-full"
                      onClick={() => markSeen(alert.id)}
                    >
                      <Search className="h-3 w-3" />
                      Analyze
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismiss(alert.id)}
                    className="rounded-lg h-8 w-8 p-0 text-muted-foreground/40 hover:text-red-400"
                    title="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
