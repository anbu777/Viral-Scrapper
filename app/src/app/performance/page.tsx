"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Loader2,
  Plus,
  Eye,
  Heart,
  MessageCircle,
  TrendingUp,
  Trash2,
  Instagram,
  Music2,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { PostedContent, Script, SocialPlatform } from "@/lib/types";

interface EnrichedPosted extends PostedContent {
  script: Script | null;
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "tiktok") return <Music2 className={className} />;
  if (platform === "youtube_shorts") return <Youtube className={className} />;
  return <Instagram className={className} />;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export default function PerformancePage() {
  const { toast } = useToast();
  const [items, setItems] = useState<EnrichedPosted[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PostedContent> & { id?: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/performance").then((r) => r.json()),
        fetch("/api/scripts").then((r) => r.json()),
      ]);
      setItems(Array.isArray(pRes) ? pRes : []);
      setScripts(Array.isArray(sRes) ? sRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing?.postedUrl || !editing.platform) {
      toast.error("URL and platform required");
      return;
    }
    try {
      if (editing.id) {
        await fetch("/api/performance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        toast.success("Performance entry updated");
      } else {
        await fetch("/api/performance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        toast.success("Performance entry added");
      }
      setEditing(null);
      load();
    } catch {
      toast.error("Save failed");
    }
  };

  const removeItem = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/performance?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((p) => p.id !== id));
    toast.success("Deleted");
  };

  const totalViews = items.reduce((s, i) => s + (i.views7d || 0), 0);
  const totalLikes = items.reduce((s, i) => s + (i.likes7d || 0), 0);
  const avg7d = items.length > 0 ? Math.round(totalViews / items.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Activity className="h-8 w-8 text-neon" />
            Performance Tracker
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track performa video yang sudah Anda posting untuk improve prediksi
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              postedUrl: "",
              platform: "instagram",
              postedAt: new Date().toISOString(),
            })
          }
          className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold"
        >
          <Plus className="h-4 w-4" />
          Add Posted Content
        </Button>
      </div>

      {/* Summary Cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Posts Tracked" value={items.length.toString()} icon={Activity} />
          <SummaryCard label="Total Views (7d)" value={formatViews(totalViews)} icon={Eye} />
          <SummaryCard label="Total Likes (7d)" value={formatViews(totalLikes)} icon={Heart} />
          <SummaryCard label="Avg Views/Post" value={formatViews(avg7d)} icon={TrendingUp} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Activity className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-4 font-semibold">Belum ada konten yang di-track</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tambahkan link konten yang sudah Anda posting untuk track performa
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PlatformIcon platform={item.platform} className="h-3.5 w-3.5 text-muted-foreground" />
                    <a
                      href={item.postedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold hover:text-neon truncate"
                    >
                      {item.script?.title || item.postedUrl}
                    </a>
                    <Badge className="bg-white/[0.05] border-white/[0.08] text-[10px]">
                      {new Date(item.postedAt).toLocaleDateString("en-US")}
                    </Badge>
                  </div>
                  {item.script && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      Script: {item.script.hook}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    <Metric label="24h" value={formatViews(item.views24h)} icon={Eye} />
                    <Metric label="48h" value={formatViews(item.views48h)} icon={Eye} />
                    <Metric label="7d Views" value={formatViews(item.views7d)} icon={Eye} highlight />
                    <Metric label="7d Likes" value={formatViews(item.likes7d)} icon={Heart} />
                    <Metric label="7d Comm." value={formatViews(item.comments7d)} icon={MessageCircle} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button
                    onClick={() => setEditing(item)}
                    variant="ghost"
                    size="sm"
                    className="rounded-lg h-7 text-[10px]"
                  >
                    Update
                  </Button>
                  <Button
                    onClick={() => removeItem(item.id)}
                    variant="ghost"
                    size="sm"
                    className="rounded-lg h-7 text-[10px] text-muted-foreground/50 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Update Metrics" : "Add Posted Content"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Posted URL</label>
                <Input
                  value={editing.postedUrl || ""}
                  onChange={(e) => setEditing({ ...editing, postedUrl: e.target.value })}
                  placeholder="https://www.instagram.com/p/..."
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Platform</label>
                  <Select
                    value={editing.platform || "instagram"}
                    onValueChange={(v) => setEditing({ ...editing, platform: v as SocialPlatform })}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Posted At</label>
                  <Input
                    type="datetime-local"
                    value={editing.postedAt ? editing.postedAt.slice(0, 16) : ""}
                    onChange={(e) => setEditing({ ...editing, postedAt: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Linked Script (optional)</label>
                <Select
                  value={editing.scriptId || "none"}
                  onValueChange={(v) => setEditing({ ...editing, scriptId: v === "none" ? null : v })}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {scripts.slice(0, 50).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title || s.hook || "(untitled script)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Views 24h</label>
                  <Input
                    type="number"
                    value={editing.views24h || 0}
                    onChange={(e) => setEditing({ ...editing, views24h: parseInt(e.target.value, 10) || 0 })}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Views 48h</label>
                  <Input
                    type="number"
                    value={editing.views48h || 0}
                    onChange={(e) => setEditing({ ...editing, views48h: parseInt(e.target.value, 10) || 0 })}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Views 7d</label>
                  <Input
                    type="number"
                    value={editing.views7d || 0}
                    onChange={(e) => setEditing({ ...editing, views7d: parseInt(e.target.value, 10) || 0 })}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Likes 7d</label>
                  <Input
                    type="number"
                    value={editing.likes7d || 0}
                    onChange={(e) => setEditing({ ...editing, likes7d: parseInt(e.target.value, 10) || 0 })}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Comments 7d</label>
                  <Input
                    type="number"
                    value={editing.comments7d || 0}
                    onChange={(e) => setEditing({ ...editing, comments7d: parseInt(e.target.value, 10) || 0 })}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setEditing(null)} variant="ghost" className="rounded-xl">Cancel</Button>
              <Button onClick={save} className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 font-semibold">
                {editing.id ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, highlight }: { label: string; value: string; icon: typeof Eye; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${highlight ? "bg-neon/5 border border-neon/15" : "bg-white/[0.03] border border-white/[0.05]"}`}>
      <div className="flex items-center gap-1 text-muted-foreground/60 text-[9px]">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </div>
      <div className={`mt-0.5 font-bold ${highlight ? "text-neon" : ""}`}>{value}</div>
    </div>
  );
}
