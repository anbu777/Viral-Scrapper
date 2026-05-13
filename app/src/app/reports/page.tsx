"use client";

import { useEffect, useState } from "react";
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
  FileText,
  Loader2,
  Sparkles,
  Download,
  Eye,
  Trash2,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportSummary {
  id: string;
  configName: string;
  periodFrom: string;
  periodTo: string;
  createdAt: string;
  summary: {
    totalVideos: number;
    totalViews: number;
    avgVirality: number;
    viralCount: number;
    topPlatform: string;
  } | null;
}

interface FullReport {
  id: string;
  configName: string;
  periodFrom: string;
  periodTo: string;
  createdAt: string;
  report: {
    period: { from: string; to: string };
    stats: {
      totalVideos: number;
      totalViews: number;
      avgVirality: number;
      viralCount: number;
      topPlatform: string;
    };
    topVideos: Array<{
      creator: string;
      platform: string;
      views: number;
      viralityScore: number;
      link: string;
      caption: string;
      formatPattern: string;
    }>;
    viralPatterns: {
      formats: string[];
      hooks: string[];
      avgDurationSeconds: number;
      bestPostingHours: string[];
    };
    topCreators: Array<{ username: string; totalViews: number; videoCount: number }>;
    recommendations: string[];
  };
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [configs, setConfigs] = useState<{ configName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState<"7" | "14" | "30">("7");
  const [configName, setConfigName] = useState<string>("all");
  const [selected, setSelected] = useState<FullReport | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([
        fetch("/api/reports").then((r) => r.json()),
        fetch("/api/configs").then((r) => r.json()),
      ]);
      setReports(Array.isArray(rRes) ? rRes : []);
      setConfigs(Array.isArray(cRes) ? cRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configName: configName === "all" ? undefined : configName,
          daysBack: parseInt(period, 10),
        }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      toast.success("Report generated successfully");
      load();
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const viewReport = async (id: string) => {
    try {
      const res = await fetch(`/api/reports/${id}`);
      const data = (await res.json()) as FullReport;
      setSelected(data);
    } catch {
      toast.error("Failed to load report");
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
    setReports((prev) => prev.filter((r) => r.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success("Report deleted");
  };

  const downloadMd = (id: string) => {
    window.open(`/api/reports/${id}?format=markdown`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-neon" />
            Intelligence Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-generated weekly insights tentang trend dan rekomendasi konten
          </p>
        </div>
      </div>

      {/* Generate New Report */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold mb-3">Generate New Report</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Config</label>
            <Select value={configName} onValueChange={setConfigName}>
              <SelectTrigger className="w-[180px] rounded-xl glass border-white/[0.08] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All configs</SelectItem>
                {configs.map((c) => (
                  <SelectItem key={c.configName} value={c.configName}>
                    {c.configName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Period</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as "7" | "14" | "30")}>
              <SelectTrigger className="w-[160px] rounded-xl glass border-white/[0.08] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={generateReport}
            disabled={generating}
            className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold h-10"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </Button>
        </div>
      </div>

      {/* Reports List + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Saved Reports</h2>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-3 text-xs text-muted-foreground">No reports yet</p>
            </div>
          ) : (
            reports.map((r) => (
              <div
                key={r.id}
                className={`glass rounded-2xl p-4 cursor-pointer transition-all ${
                  selected?.id === r.id ? "border-neon/30 bg-neon/5" : "hover:bg-white/[0.02]"
                }`}
                onClick={() => viewReport(r.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="bg-white/[0.05] border-white/[0.08] text-[10px]">
                    {r.configName}
                  </Badge>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadMd(r.id);
                      }}
                      className="text-muted-foreground/50 hover:text-foreground p-1"
                      title="Download Markdown"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteReport(r.id);
                      }}
                      className="text-muted-foreground/50 hover:text-red-400 p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {r.periodFrom} → {r.periodTo}
                </div>
                {r.summary && (
                  <div className="mt-2 flex gap-3 text-xs">
                    <span className="text-muted-foreground">
                      <Eye className="inline h-3 w-3 mr-0.5" />
                      {formatViews(r.summary.totalViews)}
                    </span>
                    <span className="text-amber-400">
                      <TrendingUp className="inline h-3 w-3 mr-0.5" />
                      {r.summary.avgVirality}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <ReportDetail report={selected} onDownload={() => downloadMd(selected.id)} />
          ) : (
            <div className="glass rounded-2xl p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-4 text-sm text-muted-foreground">Pilih report dari list untuk melihat detail</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportDetail({ report: data, onDownload }: { report: FullReport; onDownload: () => void }) {
  const r = data.report;
  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold">{data.configName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {r.period.from} → {r.period.to}
          </p>
        </div>
        <Button onClick={onDownload} variant="ghost" className="rounded-xl glass border-white/[0.08] gap-1.5 h-8">
          <Download className="h-3 w-3" />
          Markdown
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Videos" value={r.stats.totalVideos.toString()} />
        <Stat label="Total Views" value={formatViews(r.stats.totalViews)} />
        <Stat label="Avg Virality" value={r.stats.avgVirality.toString()} />
        <Stat label="Viral Count" value={r.stats.viralCount.toString()} />
      </div>

      {r.topVideos.length > 0 && (
        <Section title="Top Performing Videos">
          <div className="space-y-2">
            {r.topVideos.slice(0, 5).map((v, i) => (
              <div key={i} className="text-xs p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="flex justify-between">
                  <a
                    href={v.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:text-neon"
                  >
                    @{v.creator}
                  </a>
                  <span className="text-muted-foreground">
                    {formatViews(v.views)} · score {v.viralityScore.toFixed(0)}
                  </span>
                </div>
                {v.caption && <p className="mt-1 text-muted-foreground line-clamp-2">{v.caption}</p>}
                <Badge className="mt-1.5 bg-purple-500/15 border-purple-500/25 text-purple-300 text-[9px]">
                  {v.formatPattern}
                </Badge>
              </div>
            ))}
          </div>
        </Section>
      )}

      {r.viralPatterns.formats.length > 0 && (
        <Section title="Viral Patterns">
          <div className="text-xs space-y-2">
            <div>
              <span className="text-muted-foreground">Top formats: </span>
              <span className="text-foreground">{r.viralPatterns.formats.join(", ")}</span>
            </div>
            {r.viralPatterns.avgDurationSeconds > 0 && (
              <div>
                <span className="text-muted-foreground">Avg duration: </span>
                <span className="text-foreground">{r.viralPatterns.avgDurationSeconds}s</span>
              </div>
            )}
            {r.viralPatterns.bestPostingHours.length > 0 && (
              <div>
                <span className="text-muted-foreground">Best posting times: </span>
                <span className="text-foreground">{r.viralPatterns.bestPostingHours.join(", ")}</span>
              </div>
            )}
          </div>
        </Section>
      )}

      {r.viralPatterns.hooks.length > 0 && (
        <Section title="Top Hooks">
          <div className="space-y-1.5">
            {r.viralPatterns.hooks.map((h, i) => (
              <p key={i} className="text-xs italic text-muted-foreground">
                <span className="text-muted-foreground/50 mr-1.5">#{i + 1}</span>
                &ldquo;{h}&rdquo;
              </p>
            ))}
          </div>
        </Section>
      )}

      {r.recommendations.length > 0 && (
        <Section title="Recommendations">
          <ul className="space-y-1.5 text-xs">
            {r.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-neon">→</span>
                <span className="text-muted-foreground">{rec}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
      <div className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">{label}</div>
      <div className="mt-1 text-base font-bold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{title}</h3>
      {children}
    </div>
  );
}
