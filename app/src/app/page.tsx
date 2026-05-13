"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VideoThumbnail } from "@/components/avatar-placeholder";
import {
  Film,
  FileText,
  Users,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Loader2,
  Sparkles,
  Zap,
  Settings,
  Play,
  TrendingUp,
  Calendar,
  Compass,
  Activity,
  ScrollText,
} from "lucide-react";

interface DashboardData {
  stats: {
    totalVideos: number;
    analyzedVideos: number;
    totalScripts: number;
    totalCreators: number;
    totalConfigs: number;
    viralAlerts?: number;
    lastRun: { id: string; status: string; configName: string; completedAt: string | null } | null;
  };
  providerHealth: {
    gemini: boolean;
    apify: boolean;
    youtubeApi: boolean;
    claude: boolean;
    fal: boolean;
    telegram: boolean;
  };
  warnings: { type: "error" | "warning" | "info"; message: string; action?: { label: string; href: string } }[];
  recentActivity: { type: string; title: string; subtitle: string; timestamp: string }[];
  topViral: {
    id: string;
    creator: string;
    views: number;
    thumbnail: string;
    link: string;
    platform?: string;
    viralityScore?: number;
  }[];
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: DashboardData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-muted-foreground">Failed to load dashboard.</div>;
  }

  const setupComplete = data.warnings.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight gradient-text">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your social media intelligence at a glance
        </p>
      </div>

      {/* Warnings / Setup Issues */}
      {data.warnings.length > 0 && (
        <div className="space-y-2">
          {data.warnings.map((w, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 flex items-start gap-3 ${
                w.type === "error"
                  ? "border-red-500/25 bg-red-500/5"
                  : w.type === "warning"
                  ? "border-amber-500/25 bg-amber-500/5"
                  : "border-blue-500/25 bg-blue-500/5"
              }`}
            >
              <AlertTriangle
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  w.type === "error"
                    ? "text-red-400"
                    : w.type === "warning"
                    ? "text-amber-400"
                    : "text-blue-400"
                }`}
              />
              <p className="text-sm flex-1">{w.message}</p>
              {w.action && (
                <Link href={w.action.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg gap-1.5 text-xs h-8 glass border-white/[0.08]"
                  >
                    {w.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Film}
          label="Videos Analyzed"
          value={data.stats.analyzedVideos}
          total={data.stats.totalVideos}
          color="neon"
        />
        <StatCard
          icon={FileText}
          label="Scripts Generated"
          value={data.stats.totalScripts}
          color="emerald"
        />
        <StatCard
          icon={Users}
          label="Creators Tracked"
          value={data.stats.totalCreators}
          color="blue"
        />
        <StatCard
          icon={Flame}
          label="Viral Alerts"
          value={data.stats.viralAlerts || 0}
          color="amber"
        />
      </div>

      {/* Provider Health */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neon" />
            Provider Health
          </h2>
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-xs h-8 glass border-white/[0.08]">
              <Settings className="h-3 w-3" />
              Configure
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <ProviderStatus name="Gemini AI" ok={data.providerHealth.gemini} />
          <ProviderStatus name="Claude AI" ok={data.providerHealth.claude} optional />
          <ProviderStatus name="Apify Scraper" ok={data.providerHealth.apify} optional />
          <ProviderStatus name="YouTube API" ok={data.providerHealth.youtubeApi} optional />
          <ProviderStatus name="fal.ai Video" ok={data.providerHealth.fal} optional />
          <ProviderStatus name="Telegram Bot" ok={data.providerHealth.telegram} optional />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-neon" />
            Recent Activity
          </h2>
          {data.recentActivity.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No activity yet</p>
              <Link href="/run">
                <Button className="mt-4 rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold">
                  <Play className="h-3.5 w-3.5" />
                  Run First Pipeline
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {data.recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-neon mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-tight truncate">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.subtitle}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">{a.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Viral This Week */}
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            Top Viral This Week
          </h2>
          {data.topViral.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No viral videos yet — run a pipeline to get started
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.topViral.map((v) => (
                <Link
                  key={v.id}
                  href={`/videos?creator=${encodeURIComponent(v.creator)}`}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div className="h-12 w-9 rounded-md overflow-hidden bg-white/[0.05] shrink-0">
                    <VideoThumbnail src={v.thumbnail} creator={v.creator} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">@{v.creator}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatViews(v.views)} views · {v.platform || "instagram"}
                    </p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {setupComplete && (
        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/run">
            <div className="glass rounded-2xl p-5 hover:bg-white/[0.05] transition-colors cursor-pointer group">
              <Play className="h-5 w-5 text-neon mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-sm font-semibold">Run Pipeline</h3>
              <p className="text-xs text-muted-foreground mt-1">Scrape, analyze, generate scripts</p>
            </div>
          </Link>
          <Link href="/import">
            <div className="glass rounded-2xl p-5 hover:bg-white/[0.05] transition-colors cursor-pointer group">
              <Film className="h-5 w-5 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-sm font-semibold">Import URLs</h3>
              <p className="text-xs text-muted-foreground mt-1">Add specific videos manually</p>
            </div>
          </Link>
          <Link href="/scripts">
            <div className="glass rounded-2xl p-5 hover:bg-white/[0.05] transition-colors cursor-pointer group">
              <FileText className="h-5 w-5 text-emerald-400 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-sm font-semibold">View Scripts</h3>
              <p className="text-xs text-muted-foreground mt-1">Generated content ready to use</p>
            </div>
          </Link>
        </div>
      )}

      {/* Intelligence Tools */}
      {setupComplete && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-widest">
            Intelligence Tools
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Link href="/trends">
              <div className="glass rounded-2xl p-4 hover:bg-white/[0.05] transition-colors cursor-pointer group">
                <TrendingUp className="h-4 w-4 text-neon mb-2 group-hover:scale-110 transition-transform" />
                <h3 className="text-xs font-semibold">Trends</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pattern viral & analytics</p>
              </div>
            </Link>
            <Link href="/reports">
              <div className="glass rounded-2xl p-4 hover:bg-white/[0.05] transition-colors cursor-pointer group">
                <ScrollText className="h-4 w-4 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <h3 className="text-xs font-semibold">Reports</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Weekly intelligence reports</p>
              </div>
            </Link>
            <Link href="/discover">
              <div className="glass rounded-2xl p-4 hover:bg-white/[0.05] transition-colors cursor-pointer group">
                <Compass className="h-4 w-4 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                <h3 className="text-xs font-semibold">Discover</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Find creators by niche</p>
              </div>
            </Link>
            <Link href="/calendar">
              <div className="glass rounded-2xl p-4 hover:bg-white/[0.05] transition-colors cursor-pointer group">
                <Calendar className="h-4 w-4 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <h3 className="text-xs font-semibold">Calendar</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Plan your content</p>
              </div>
            </Link>
            <Link href="/performance">
              <div className="glass rounded-2xl p-4 hover:bg-white/[0.05] transition-colors cursor-pointer group">
                <Activity className="h-4 w-4 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                <h3 className="text-xs font-semibold">Performance</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Track post results</p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  total?: number;
  color: "neon" | "emerald" | "blue" | "amber";
}

function StatCard({ icon: Icon, label, value, total, color }: StatCardProps) {
  const colorClass = {
    neon: "text-neon bg-neon/10 border-neon/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  }[color];

  return (
    <div className="glass rounded-2xl p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight">
          {value}
          {total !== undefined && total !== value && (
            <span className="text-sm font-normal text-muted-foreground"> / {total}</span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function ProviderStatus({ name, ok, optional }: { name: string; ok: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      ) : (
        <div
          className={`h-3.5 w-3.5 rounded-full ${
            optional ? "bg-muted-foreground/20" : "bg-red-500/40"
          } shrink-0`}
        />
      )}
      <span className={ok ? "text-foreground/80" : "text-muted-foreground/60"}>{name}</span>
      {!ok && !optional && (
        <Badge variant="secondary" className="ml-auto rounded-md text-[9px] bg-red-500/10 border-red-500/20 text-red-400">
          Required
        </Badge>
      )}
    </div>
  );
}
