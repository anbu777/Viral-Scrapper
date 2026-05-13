"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  Eye,
  Flame,
  UserPlus,
  Check,
  Instagram,
  Music2,
  Youtube,
  Compass,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { SocialPlatform } from "@/lib/types";

interface DiscoveredCreator {
  username: string;
  platform: SocialPlatform;
  followers: number;
  avgViews: number;
  viralityScore: number;
  sampleVideos: Array<{ link: string; views: number; thumbnail: string }>;
  alreadyTracked: boolean;
  source: string;
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

export default function DiscoverPage() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState("");
  const [platform, setPlatform] = useState<"all" | SocialPlatform>("all");
  const [results, setResults] = useState<DiscoveredCreator[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const search = async () => {
    if (!keyword.trim()) {
      toast.error("Enter a keyword to discover");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, platform, maxCreators: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.creators);
      if (data.count === 0) {
        toast.info("No creators found", "Try different keywords or scrape more videos first");
      }
    } catch (e) {
      toast.error("Search failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const addCreator = async (creator: DiscoveredCreator) => {
    setAdding(creator.username);
    try {
      const res = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: creator.username,
          platform: creator.platform,
          category: keyword,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success(`Added @${creator.username}`, `Tracking on ${creator.platform}`);
      setResults((prev) =>
        prev ? prev.map((r) => (r.username === creator.username && r.platform === creator.platform ? { ...r, alreadyTracked: true } : r)) : prev
      );
    } catch (e) {
      toast.error("Failed to add creator", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Compass className="h-8 w-8 text-neon" />
          Niche Discovery
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Temukan kreator viral di niche tertentu berdasarkan video yang sudah di-scrape
        </p>
      </div>

      {/* Search */}
      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="text-xs text-muted-foreground mb-1 block">Keyword / topic</label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="e.g. crypto indonesia, beauty hacks, real estate"
              className="rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Platform</label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
              <SelectTrigger className="w-[160px] rounded-xl glass border-white/[0.08]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube_shorts">YouTube</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={search}
            disabled={loading}
            className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold h-10"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Discover
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground/60">
          Discovery menggunakan database video lokal (caption + analysis). Untuk hasil lebih luas, pastikan banyak video sudah di-scrape via Run Pipeline.
        </p>
      </div>

      {results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {results.length} creator{results.length !== 1 ? "s" : ""} found
            </h2>
          </div>

          {results.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-4 text-sm text-muted-foreground">
                Tidak ada kreator yang cocok dengan keyword ini
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Coba keyword lain atau jalankan pipeline untuk scrape lebih banyak video terlebih dahulu
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((c) => (
                <div key={`${c.platform}-${c.username}`} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={c.platform} className="h-3.5 w-3.5 text-muted-foreground" />
                      <a
                        href={c.sampleVideos[0]?.link || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sm hover:text-neon"
                      >
                        @{c.username}
                      </a>
                    </div>
                    {c.alreadyTracked ? (
                      <Badge className="bg-emerald-500/15 border-emerald-500/25 text-emerald-400 text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" />
                        Tracked
                      </Badge>
                    ) : (
                      <Button
                        onClick={() => addCreator(c)}
                        disabled={adding === c.username}
                        size="sm"
                        className="rounded-lg h-7 bg-neon/10 text-neon hover:bg-neon/20 border border-neon/25 gap-1 text-[10px]"
                      >
                        {adding === c.username ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <UserPlus className="h-3 w-3" />
                        )}
                        Add
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                      <Eye className="h-3 w-3 mx-auto text-muted-foreground" />
                      <div className="mt-1 font-semibold">{formatViews(c.avgViews)}</div>
                      <div className="text-muted-foreground/60">avg views</div>
                    </div>
                    <div className="rounded-lg bg-amber-500/5 p-2 text-center border border-amber-500/15">
                      <Flame className="h-3 w-3 mx-auto text-amber-400" />
                      <div className="mt-1 font-semibold text-amber-400">{c.viralityScore.toFixed(0)}</div>
                      <div className="text-muted-foreground/60">virality</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                      <UserPlus className="h-3 w-3 mx-auto text-muted-foreground" />
                      <div className="mt-1 font-semibold">{formatViews(c.followers)}</div>
                      <div className="text-muted-foreground/60">followers</div>
                    </div>
                  </div>

                  {c.sampleVideos.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] text-muted-foreground/60 mb-1.5">Sample videos:</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {c.sampleVideos.map((v, i) => (
                          <a
                            key={i}
                            href={v.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-white/[0.03] hover:bg-white/[0.06] px-2 py-1 text-[10px] flex items-center gap-1"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {formatViews(v.views)}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
