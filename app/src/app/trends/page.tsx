"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Loader2,
  Eye,
  Flame,
  Zap,
  BarChart3,
  Award,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface AnalyticsData {
  period: string;
  summary: {
    totalViews: number;
    viralVideos: number;
    avgVirality: number;
    mostActivePlatform: string;
    mostActivePct: number;
    videoCount: number;
  };
  viewsOverTime: Array<{ date: string; totalViews: number; instagram: number; tiktok: number; youtube_shorts: number; count: number }>;
  topCreators: Array<{ username: string; avgViews: number; videoCount: number; viralCount: number }>;
  topFormats: Array<{ format: string; count: number; avgViews: number }>;
  postingHeatmap: Array<{ hour: number; dayOfWeek: number; engagement: number; count: number }>;
  viralPatterns: { avgDuration: number; topHooks: string[]; topFormats: string[] };
  platformDistribution: { instagram: number; tiktok: number; youtube_shorts: number };
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

const PLATFORM_COLORS = {
  instagram: "#E4405F",
  tiktok: "#00f5d4",
  youtube_shorts: "#FF0000",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TrendsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics?period=${period}`);
        const d = await res.json();
        if (!cancelled) setData(d);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [period]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.summary.videoCount === 0) {
    return (
      <div className="space-y-6">
        <Header period={period} setPeriod={setPeriod} />
        <div className="glass rounded-2xl p-12 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-4 font-semibold">Belum ada data analitik</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Jalankan pipeline untuk mulai mengumpulkan data trend dari kreator yang Anda track.
          </p>
        </div>
      </div>
    );
  }

  const platformPie = [
    { name: "Instagram", value: data.platformDistribution.instagram, color: PLATFORM_COLORS.instagram },
    { name: "TikTok", value: data.platformDistribution.tiktok, color: PLATFORM_COLORS.tiktok },
    { name: "YouTube", value: data.platformDistribution.youtube_shorts, color: PLATFORM_COLORS.youtube_shorts },
  ].filter((p) => p.value > 0);

  // Build heatmap matrix [day][hour]
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxEng = 0;
  for (const cell of data.postingHeatmap) {
    matrix[cell.dayOfWeek][cell.hour] = cell.engagement;
    if (cell.engagement > maxEng) maxEng = cell.engagement;
  }

  return (
    <div className="space-y-6">
      <Header period={period} setPeriod={setPeriod} />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Eye}
          label="Total Views"
          value={formatViews(data.summary.totalViews)}
          subtitle={`${data.summary.videoCount} videos`}
          color="text-blue-400"
        />
        <MetricCard
          icon={Flame}
          label="Viral Videos"
          value={data.summary.viralVideos.toString()}
          subtitle="score ≥ 70"
          color="text-amber-400"
        />
        <MetricCard
          icon={Zap}
          label="Avg Virality"
          value={data.summary.avgVirality.toString()}
          subtitle="across all videos"
          color="text-neon"
        />
        <MetricCard
          icon={Award}
          label="Top Platform"
          value={data.summary.mostActivePlatform === "youtube_shorts" ? "YouTube" : data.summary.mostActivePlatform.charAt(0).toUpperCase() + data.summary.mostActivePlatform.slice(1)}
          subtitle={`${data.summary.mostActivePct}% of content`}
          color="text-purple-400"
        />
      </div>

      {/* Views Over Time */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-neon" />
          Views Over Time
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.viewsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={(v) => formatViews(v)} />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,10,10,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
                formatter={(v) => formatViews(Number(v) || 0)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="instagram"
                stroke={PLATFORM_COLORS.instagram}
                strokeWidth={2}
                dot={false}
                name="Instagram"
              />
              <Line
                type="monotone"
                dataKey="tiktok"
                stroke={PLATFORM_COLORS.tiktok}
                strokeWidth={2}
                dot={false}
                name="TikTok"
              />
              <Line
                type="monotone"
                dataKey="youtube_shorts"
                stroke={PLATFORM_COLORS.youtube_shorts}
                strokeWidth={2}
                dot={false}
                name="YouTube"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Creators + Platform Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Top Creators by Avg Views</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topCreators.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={(v) => formatViews(v)} />
                <YAxis type="category" dataKey="username" stroke="rgba(255,255,255,0.4)" fontSize={11} width={90} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,10,10,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                  formatter={(v) => formatViews(Number(v) || 0)}
                />
                <Bar dataKey="avgViews" fill="#00f5d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Platform Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platformPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  label={(entry: { name?: string; percent?: number }) =>
                    `${entry.name ?? ""} ${(((entry.percent ?? 0) * 100).toFixed(0))}%`
                  }
                  labelLine={false}
                >
                  {platformPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,10,10,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Formats */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Top Content Formats</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.topFormats}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="format" stroke="rgba(255,255,255,0.4)" fontSize={10} angle={-15} textAnchor="end" height={60} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,10,10,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} name="Videos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-3">Best Posting Times (Engagement Heatmap)</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Higher color intensity = higher engagement (likes + 2× comments) at that time slot
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="p-1"></th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="p-1 text-center text-muted-foreground/50 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_NAMES.map((day, dowIdx) => (
                <tr key={day}>
                  <td className="p-1 pr-2 text-muted-foreground/70 font-medium">{day}</td>
                  {matrix[dowIdx].map((eng, hour) => {
                    const intensity = maxEng > 0 ? eng / maxEng : 0;
                    return (
                      <td
                        key={hour}
                        className="p-0"
                        title={`${day} ${hour}:00 — ${eng} avg engagement`}
                      >
                        <div
                          className="h-7 w-full rounded-sm transition-all hover:scale-110"
                          style={{
                            background: eng > 0
                              ? `rgba(0, 245, 212, ${0.1 + intensity * 0.7})`
                              : "rgba(255,255,255,0.02)",
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Viral Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            Viral Pattern Insights
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg viral duration</span>
              <Badge variant="secondary" className="bg-white/[0.05] border-white/[0.08]">
                {data.viralPatterns.avgDuration > 0 ? `${data.viralPatterns.avgDuration}s` : "N/A"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground mb-2">Top format patterns:</p>
              <div className="flex flex-wrap gap-1.5">
                {data.viralPatterns.topFormats.length > 0 ? (
                  data.viralPatterns.topFormats.map((fmt) => (
                    <Badge key={fmt} className="bg-purple-500/15 border-purple-500/25 text-purple-300 text-[10px]">
                      {fmt}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground/60">N/A</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Top Viral Hooks</h2>
          <div className="space-y-2">
            {data.viralPatterns.topHooks.length > 0 ? (
              data.viralPatterns.topHooks.map((hook, i) => (
                <div key={i} className="text-xs p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <span className="text-muted-foreground/50 mr-2">#{i + 1}</span>
                  &ldquo;{hook}&rdquo;
                </div>
              ))
            ) : (
              <span className="text-xs text-muted-foreground/60">No viral hooks detected yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ period, setPeriod }: { period: "7d" | "30d" | "90d"; setPeriod: (p: "7d" | "30d" | "90d") => void }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-neon" />
          Trends & Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pola viral, kreator teratas, dan pattern konten yang dominan
        </p>
      </div>
      <Select value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d" | "90d")}>
        <SelectTrigger className="w-[160px] rounded-xl glass border-white/[0.08] h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground/60">{subtitle}</div>
    </div>
  );
}
