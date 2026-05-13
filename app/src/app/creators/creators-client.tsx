"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Eye,
  Film,
  UserCheck,
  RefreshCw,
  Loader2,
  ExternalLink,
  Instagram,
  Music2,
  Youtube,
  Folder,
  FolderOpen,
  Link as LinkIcon,
  CheckCircle2,
  Sparkles,
  X,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CreatorGridSkeleton } from "@/components/ui/loading-skeleton";
import { suggestGroupings, aggregateGroupStats } from "@/lib/creator-grouping";
import type { Creator, CreatorGroup, SocialPlatform } from "@/lib/types";

interface CreatorGroupWithCreators extends CreatorGroup {
  creators: Creator[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function platformProfileUrl(platform: SocialPlatform, username: string): string {
  if (/^https?:\/\//i.test(username)) return username;
  if (username.startsWith("tiktokuser:")) return `https://www.tiktok.com/@${username}`;
  if (platform === "tiktok") return `https://www.tiktok.com/@${username}`;
  if (platform === "youtube_shorts") return `https://www.youtube.com/@${username}/shorts`;
  return `https://www.instagram.com/${username}/`;
}

function PlatformIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  if (platform === "tiktok") return <Music2 className={className} />;
  if (platform === "youtube_shorts") return <Youtube className={className} />;
  return <Instagram className={className} />;
}

function platformLabel(platform: SocialPlatform): string {
  if (platform === "tiktok") return "TikTok";
  if (platform === "youtube_shorts") return "YouTube";
  return "Instagram";
}

type ViewMode = "grouped" | "grid";

export function CreatorsClient({ initialCreators }: { initialCreators: Creator[] }) {
  const { toast } = useToast();
  const [creators, setCreators] = useState<Creator[]>(initialCreators);
  const [groups, setGroups] = useState<CreatorGroupWithCreators[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Creator | null>(null);
  const [form, setForm] = useState<{ username: string; category: string; platform: SocialPlatform }>({
    username: "",
    category: "",
    platform: "instagram",
  });
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshErrors, setRefreshErrors] = useState<Record<string, string>>({});
  const [groupingSuggestion, setGroupingSuggestion] = useState<Creator[] | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [creatorsData, groupsData] = await Promise.all([
        fetch("/accounts-data").then((r) => r.json()),
        fetch("/api/creator-groups").then((r) => r.json()),
      ]);
      setCreators(Array.isArray(creatorsData) ? creatorsData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const uniqueCategories = useMemo(
    () => [...new Set(creators.map((c) => c.category).filter(Boolean))].sort(),
    [creators]
  );

  // Filter creators by category and search
  const filteredCreators = useMemo(() => {
    return creators.filter((c) => {
      if (filterCategory !== "all" && c.category !== filterCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesUsername = c.username.toLowerCase().includes(q);
        const matchesAlias = (c.aliases || []).some((a) => a.toLowerCase().includes(q));
        if (!matchesUsername && !matchesAlias) return false;
      }
      return true;
    });
  }, [creators, filterCategory, searchQuery]);

  // Group view: organize creators by group + ungrouped
  const groupedView = useMemo(() => {
    const filteredIds = new Set(filteredCreators.map((c) => c.id));
    const filteredGroups = groups
      .map((g) => ({ ...g, creators: g.creators.filter((c) => filteredIds.has(c.id)) }))
      .filter((g) => g.creators.length > 0);
    const ungrouped = filteredCreators.filter((c) => !c.groupId);
    return { groups: filteredGroups, ungrouped };
  }, [filteredCreators, groups]);

  // Auto-detect potential groupings
  const suggestedGroupings = useMemo(() => suggestGroupings(creators), [creators]);

  const openNew = () => {
    setEditing(null);
    setForm({ username: "", category: "", platform: "instagram" });
    setDialogOpen(true);
  };

  const openEdit = (creator: Creator) => {
    setEditing(creator);
    setForm({
      username: creator.username,
      category: creator.category,
      platform: creator.platform || "instagram",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.category.trim()) {
      toast.error("Required fields missing", "Username and category are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await fetch("/accounts-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
        toast.success("Creator updated", `@${form.username} saved`);
      } else {
        const res = await fetch("/accounts-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.warning) {
          toast.warning("Creator saved with warning", data.warning);
        } else {
          toast.success("Creator added", `@${form.username} stats scraped successfully`);
        }
      }
      setDialogOpen(false);
      loadAll();
    } catch {
      toast.error("Save failed", "Please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (creator: Creator) => {
    if (!confirm(`Delete @${creator.username}?`)) return;
    await fetch(`/accounts-data?id=${creator.id}`, { method: "DELETE" });
    toast.success("Creator deleted", `@${creator.username} was removed`);
    loadAll();
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    setRefreshErrors({});
    try {
      const response = await fetch("/accounts-data/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress" && data.status === "scraping") {
              const c = creators.find((cr) => cr.username === data.username);
              if (c) setRefreshingId(c.id);
            } else if (data.type === "error") {
              setRefreshErrors((prev) => ({ ...prev, [data.username]: data.error || "Refresh failed" }));
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      setRefreshing(false);
      setRefreshingId(null);
      loadAll();
      toast.success("Refresh complete", "All creators updated");
    }
  };

  const handleRefreshOne = async (id: string) => {
    const creator = creators.find((c) => c.id === id);
    setRefreshingId(id);
    if (creator) {
      setRefreshErrors((prev) => {
        const next = { ...prev };
        delete next[creator.username];
        return next;
      });
    }
    try {
      const response = await fetch("/accounts-data/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "error") {
              setRefreshErrors((prev) => ({ ...prev, [data.username]: data.error || "Refresh failed" }));
            }
          } catch { /* skip */ }
        }
      }
      loadAll();
      if (creator) toast.success("Refreshed", `@${creator.username} stats updated`);
    } finally {
      setRefreshingId(null);
    }
  };

  const createGroupFromSuggestion = async (suggestion: Creator[]) => {
    const canonicalCreator = suggestion.reduce((biggest, c) => (c.followers > biggest.followers ? c : biggest));
    const groupName = canonicalCreator.username;
    try {
      const res = await fetch("/api/creator-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          canonicalUsername: canonicalCreator.username,
          avatarUrl: canonicalCreator.profilePicUrl,
          notes: `Auto-grouped from ${suggestion.length} accounts`,
          creatorIds: suggestion.map((c) => c.id),
        }),
      });
      if (res.ok) {
        toast.success("Group created", `"${groupName}" with ${suggestion.length} accounts`);
        setGroupingSuggestion(null);
        loadAll();
      }
    } catch {
      toast.error("Failed to create group");
    }
  };

  const ungroupCreator = async (creatorId: string) => {
    await fetch("/accounts-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: creatorId, groupId: null }),
    });
    loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creators</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track competitors across Instagram, TikTok, and YouTube — same person grouped automatically
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="rounded-xl glass border-white/[0.08] gap-1.5 text-xs"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh All
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-1.5 font-semibold">
                <Plus className="h-4 w-4" />
                Add Creator
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong rounded-2xl border-white/[0.08]">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Creator" : "Add Creator"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Platform</Label>
                  <Select
                    value={form.platform}
                    onValueChange={(v) => setForm({ ...form, platform: v as SocialPlatform })}
                  >
                    <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-11">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {form.platform === "tiktok" ? "TikTok Username" : form.platform === "youtube_shorts" ? "YouTube Handle" : "Instagram Username"}
                  </Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder={form.platform === "tiktok" ? "e.g. mrbeast" : form.platform === "youtube_shorts" ? "e.g. MrBeast" : "e.g. timothyronald"}
                    className="mt-1.5 rounded-xl glass border-white/[0.08] h-11"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. crypto, finance, ai"
                    className="mt-1.5 rounded-xl glass border-white/[0.08] h-11"
                    list="creator-categories-list"
                  />
                  <datalist id="creator-categories-list">
                    {uniqueCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving || !form.username || !form.category}
                  className="w-full rounded-xl h-11 bg-neon text-black hover:bg-neon/90 border-0 font-semibold"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editing ? "Saving..." : "Adding..."}
                    </>
                  ) : (
                    editing ? "Save Changes" : "Add Creator"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Auto-grouping suggestions */}
      {suggestedGroupings.length > 0 && (
        <div className="rounded-2xl border border-neon/25 bg-neon/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neon" />
            <p className="text-sm font-semibold">Suggested Groupings</p>
            <Badge variant="secondary" className="ml-auto rounded-md text-[10px] bg-neon/15 text-neon border-neon/25">
              {suggestedGroupings.length} found
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            These creators look like the same person across multiple platforms. Group them to track combined performance.
          </p>
          <div className="space-y-2">
            {suggestedGroupings.slice(0, 3).map((suggestion, i) => (
              <div key={i} className="rounded-xl bg-black/20 border border-white/[0.04] p-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  {suggestion.map((c) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="rounded-md text-[11px] bg-white/[0.05] border border-white/[0.08]"
                    >
                      <PlatformIcon platform={c.platform} className="h-2.5 w-2.5 mr-1" />
                      @{c.username}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => createGroupFromSuggestion(suggestion)}
                  className="rounded-lg h-8 gap-1.5 text-xs bg-neon/15 hover:bg-neon/25 text-neon border border-neon/25"
                  variant="ghost"
                >
                  <Folder className="h-3 w-3" />
                  Group
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search creators..."
            className="pl-9 rounded-xl glass border-white/[0.08] h-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px] rounded-xl glass border-white/[0.08] h-10">
            <SelectValue placeholder="Filter category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {uniqueCategories.filter(Boolean).map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View mode toggle */}
        <div className="flex rounded-xl glass border border-white/[0.08] p-1">
          <button
            onClick={() => setViewMode("grouped")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              viewMode === "grouped" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground"
            }`}
          >
            <Folder className="h-3 w-3" />
            Grouped
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              viewMode === "grid" ? "bg-white/[0.08] text-foreground" : "text-muted-foreground"
            }`}
          >
            <Users className="h-3 w-3" />
            All
          </button>
        </div>

        <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs bg-white/[0.05] border border-white/[0.08]">
          {filteredCreators.length} creators
        </Badge>
      </div>

      {/* Body */}
      {loading ? (
        <CreatorGridSkeleton />
      ) : viewMode === "grouped" ? (
        <div className="space-y-6">
          {/* Groups */}
          {groupedView.groups.map((group) => {
            const stats = aggregateGroupStats(group.creators);
            return (
              <div key={group.id} className="glass rounded-2xl p-5 border-neon/15">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neon/20 to-emerald-500/20 border border-neon/30">
                      <FolderOpen className="h-4 w-4 text-neon" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">{group.name}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {group.creators.length} platforms · {formatNumber(stats.totalFollowers)} combined reach
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/videos?creator=${encodeURIComponent(group.creators.flatMap((c) => [c.username, ...(c.aliases || [])]).join(","))}`}
                  >
                    <Button variant="ghost" size="sm" className="rounded-lg h-8 gap-1.5 text-xs glass border border-white/[0.06]">
                      <Film className="h-3 w-3" />
                      View Videos
                    </Button>
                  </Link>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.creators.map((creator) => (
                    <CreatorMiniCard
                      key={creator.id}
                      creator={creator}
                      onEdit={() => openEdit(creator)}
                      onDelete={() => handleDelete(creator)}
                      onRefresh={() => handleRefreshOne(creator.id)}
                      onUngroup={() => ungroupCreator(creator.id)}
                      refreshing={refreshingId === creator.id}
                      error={refreshErrors[creator.username]}
                      inGroup
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Ungrouped */}
          {groupedView.ungrouped.length > 0 && (
            <div className="space-y-3">
              {groupedView.groups.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Ungrouped ({groupedView.ungrouped.length})
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupedView.ungrouped.map((creator) => (
                  <CreatorCard
                    key={creator.id}
                    creator={creator}
                    onEdit={() => openEdit(creator)}
                    onDelete={() => handleDelete(creator)}
                    onRefresh={() => handleRefreshOne(creator.id)}
                    refreshing={refreshingId === creator.id}
                    error={refreshErrors[creator.username]}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredCreators.length === 0 && (
            <EmptyState onAdd={openNew} />
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCreators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              onEdit={() => openEdit(creator)}
              onDelete={() => handleDelete(creator)}
              onRefresh={() => handleRefreshOne(creator.id)}
              refreshing={refreshingId === creator.id}
              error={refreshErrors[creator.username]}
            />
          ))}
          {filteredCreators.length === 0 && <EmptyState onAdd={openNew} />}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CreatorCardProps {
  creator: Creator;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  error?: string;
}

function CreatorCard({ creator, onEdit, onDelete, onRefresh, refreshing, error }: CreatorCardProps) {
  return (
    <div className={`group glass rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.1] ${refreshing ? "animate-pulse" : ""}`}>
      <div className="flex items-start justify-between">
        <a
          href={platformProfileUrl(creator.platform || "instagram", creator.username)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0"
        >
          <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-neon/10 to-emerald-500/10 border border-white/[0.1]">
            {creator.profilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(creator.profilePicUrl)}`}
                alt={`@${creator.username}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground/50">
                {creator.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.1] bg-black/80 text-neon">
              <PlatformIcon platform={creator.platform || "instagram"} className="h-3 w-3" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">@{creator.username}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">{platformLabel(creator.platform || "instagram")}</span>
              <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
                {creator.category}
              </Badge>
            </div>
          </div>
        </a>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {creator.followers > 0 || creator.lastScrapedAt ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat icon={UserCheck} value={formatNumber(creator.followers)} label="Followers" />
          <Stat icon={Film} value={String(creator.reelsCount30d)} label="Reels/30d" />
          <Stat icon={Eye} value={formatNumber(creator.avgViews30d)} label="Avg Views" />
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-black/20 border border-white/[0.04] p-3 text-center">
          <p className="text-[11px] text-muted-foreground">
            No stats yet — click <RefreshCw className="inline h-3 w-3" /> to scrape
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-2.5">
          <p className="text-[11px] leading-relaxed text-red-300 line-clamp-3">{error}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        {creator.lastScrapedAt ? (
          <p className="text-[10px] text-muted-foreground/60" suppressHydrationWarning>
            Scraped {new Date(creator.lastScrapedAt).toLocaleDateString("en-US")}
          </p>
        ) : <span />}
        <Link
          href={`/videos?creator=${encodeURIComponent([creator.username, ...(creator.aliases || [])].join(","))}`}
          className="inline-flex items-center gap-1 text-[11px] text-neon hover:text-neon transition-colors"
        >
          View videos <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

interface CreatorMiniCardProps extends CreatorCardProps {
  onUngroup?: () => void;
  inGroup?: boolean;
}

function CreatorMiniCard({ creator, onEdit, onDelete, onRefresh, onUngroup, refreshing }: CreatorMiniCardProps) {
  return (
    <div className="group rounded-xl bg-black/20 border border-white/[0.04] p-3 hover:bg-black/30 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="relative h-8 w-8 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-neon/10 to-emerald-500/10 border border-white/[0.06]">
          {creator.profilePicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/proxy-image?url=${encodeURIComponent(creator.profilePicUrl)}`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground/50">
              {creator.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <PlatformIcon platform={creator.platform} className="h-3 w-3 text-neon" />
            <p className="text-xs font-medium truncate">@{creator.username}</p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {formatNumber(creator.followers)} · {formatNumber(creator.avgViews30d)} avg views
          </p>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing} className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-foreground">
            {refreshing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
          </Button>
          {onUngroup && (
            <Button variant="ghost" size="sm" onClick={onUngroup} className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-amber-400" title="Remove from group">
              <X className="h-2.5 w-2.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-foreground">
            <Pencil className="h-2.5 w-2.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-red-400">
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/[0.04] p-2.5 text-center">
      <Icon className="mx-auto h-3.5 w-3.5 text-neon mb-1" />
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="col-span-full glass rounded-2xl p-12 text-center">
      <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
      <h3 className="mt-4 font-semibold">No creators yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">Add competitors to start tracking viral content.</p>
      <Button onClick={onAdd} className="mt-4 rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold">
        <Plus className="h-4 w-4" />
        Add Creator
      </Button>
    </div>
  );
}
