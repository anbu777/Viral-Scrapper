"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Info, Instagram, Music2, Youtube } from "lucide-react";
import { detectPlatform, platformDisplayName } from "@/lib/platform-detect";
import type { SocialPlatform } from "@/lib/types";

type PlatformChoice = "auto" | SocialPlatform;

const PLACEHOLDER = `https://www.instagram.com/reel/...
https://www.tiktok.com/@user/video/...
https://www.youtube.com/shorts/...`;

function platformIcon(platform: SocialPlatform | "unknown") {
  if (platform === "instagram") return <Instagram className="h-3.5 w-3.5" />;
  if (platform === "tiktok") return <Music2 className="h-3.5 w-3.5" />;
  if (platform === "youtube_shorts") return <Youtube className="h-3.5 w-3.5" />;
  return <Info className="h-3.5 w-3.5" />;
}

export default function ImportPage() {
  const [configName, setConfigName] = useState("Manual Import");
  const [creator, setCreator] = useState("manual");
  const [platformOverride, setPlatformOverride] = useState<PlatformChoice>("auto");
  const [urls, setUrls] = useState("");
  const [result, setResult] = useState<string>("");
  const [skipped, setSkipped] = useState<Array<{ url: string; reason: string }>>([]);
  const [enrichResults, setEnrichResults] = useState<Array<{ url: string; status: string; platform?: string; error?: string; creator?: string }>>([]);
  const [loading, setLoading] = useState(false);

  const parsedUrls = useMemo(() => {
    return urls
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean)
      .map((u) => ({ url: u, detected: detectPlatform(u) }));
  }, [urls]);

  const previewCounts = useMemo(() => {
    const counts: Record<SocialPlatform | "unknown", number> = {
      instagram: 0,
      tiktok: 0,
      youtube_shorts: 0,
      unknown: 0,
    };
    for (const p of parsedUrls) counts[p.detected.platform] += 1;
    return counts;
  }, [parsedUrls]);

  const submit = async () => {
    setLoading(true);
    setResult("");
    setSkipped([]);
    setEnrichResults([]);
    try {
      const payload = {
        configName,
        urls: parsedUrls.map(({ url }) => ({
          url,
          creator,
          ...(platformOverride !== "auto" ? { platform: platformOverride } : {}),
        })),
      };
      const res = await fetch("/api/import/instagram-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(typeof data.error === "string" ? data.error : `Import failed (HTTP ${res.status}).`);
        return;
      }
      setResult(`Imported ${data.imported ?? 0} video${(data.imported ?? 0) === 1 ? "" : "s"}.`);
      if (Array.isArray(data.skipped) && data.skipped.length) setSkipped(data.skipped);
      if (Array.isArray(data.enrichmentResults)) setEnrichResults(data.enrichmentResults);
      if (data.ytdlpAvailable === false && (previewCounts.tiktok + previewCounts.youtube_shorts) > 0) {
        setResult((prev) => `${prev} Note: yt-dlp is not installed, so TikTok/YouTube videos were imported without thumbnails or view counts.`);
      }
    } catch (error) {
      setResult(error instanceof Error ? `Import error: ${error.message}` : "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manual Import</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste video URLs from <strong>Instagram</strong>, <strong>TikTok</strong>, or <strong>YouTube Shorts</strong>. The platform is auto-detected from each URL.
        </p>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            placeholder="Config name"
            className="rounded-xl"
          />
          <Input
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            placeholder="Default creator username"
            className="rounded-xl"
          />
          <Select value={platformOverride} onValueChange={(v) => setPlatformOverride(v as PlatformChoice)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect per URL</SelectItem>
              <SelectItem value="instagram">Force Instagram</SelectItem>
              <SelectItem value="tiktok">Force TikTok</SelectItem>
              <SelectItem value="youtube_shorts">Force YouTube Shorts</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder={PLACEHOLDER}
          className="min-h-56 rounded-xl font-mono text-xs"
        />

        {parsedUrls.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Detected:</span>
            {(["instagram", "tiktok", "youtube_shorts", "unknown"] as const).map((p) =>
              previewCounts[p] > 0 ? (
                <Badge
                  key={p}
                  variant="outline"
                  className={`gap-1.5 ${p === "unknown" ? "border-red-500/40 text-red-300" : "border-neon/30 text-neon"}`}
                >
                  {platformIcon(p)}
                  {previewCounts[p]} {platformDisplayName(p)}
                </Badge>
              ) : null
            )}
          </div>
        )}

        <Button onClick={submit} disabled={loading || parsedUrls.length === 0} className="rounded-xl gap-2">
          <Upload className="h-4 w-4" />
          {loading ? "Importing..." : `Import ${parsedUrls.length || ""} URLs`}
        </Button>

        {result && <p className="text-sm text-muted-foreground">{result}</p>}

        {enrichResults.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-card/50 p-3 text-xs space-y-1.5">
            <p className="font-medium text-foreground">Import details:</p>
            {enrichResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2 font-mono truncate">
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                  r.status === "enriched" ? "bg-green-500" : r.status === "basic" ? "bg-yellow-500" : "bg-red-500"
                }`} />
                <span className="text-muted-foreground truncate max-w-[280px]">{r.url.replace(/^https?:\/\//, "")}</span>
                <span className={r.status === "enriched" ? "text-green-400" : r.status === "basic" ? "text-yellow-400" : "text-red-400"}>
                  {r.status === "enriched" ? "✓ Full metadata" : r.status === "basic" ? "⚠ Basic (no yt-dlp)" : "✗ Skipped"}
                </span>
                {r.creator && r.creator !== "manual" && <span className="text-neon">@{r.creator}</span>}
                {r.error && <span className="text-red-400/70 truncate max-w-[200px]" title={r.error}>— {r.error}</span>}
              </div>
            ))}
          </div>
        )}

        {skipped.length > 0 && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs space-y-1">
            <p className="font-medium text-yellow-300">Skipped {skipped.length} URL{skipped.length === 1 ? "" : "s"}:</p>
            {skipped.map((s, i) => (
              <p key={i} className="text-muted-foreground font-mono truncate">
                {s.url} — {s.reason}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-5 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground flex items-center gap-2">
          <Info className="h-3.5 w-3.5" /> Multi-platform support
        </p>
        <p>
          <strong>Instagram</strong>, <strong>TikTok</strong>, and <strong>YouTube Shorts</strong> can be enriched on import with{" "}
          <code className="text-neon">yt-dlp</code> (thumbnail, stats, caption, and often a direct video URL for full Gemini analysis). Install:{" "}
          <code className="text-neon">winget install yt-dlp</code> (Windows) or <code className="text-neon">brew install yt-dlp</code> (macOS). If yt-dlp cannot
          fetch the media, the URL is still saved; analysis then falls back to caption/metadata only unless the pipeline can download the file.
        </p>
        <p>
          TikTok and YouTube Shorts typically show thumbnails immediately when <code className="text-neon">yt-dlp</code> succeeds.
        </p>
      </div>
    </div>
  );
}
