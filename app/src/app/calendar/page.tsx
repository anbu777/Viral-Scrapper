"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Instagram,
  Music2,
  Youtube,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { ContentCalendarEntry, Script, SocialPlatform } from "@/lib/types";

type Status = "draft" | "recorded" | "posted" | "cancelled";

const STATUS_COLORS: Record<Status, string> = {
  draft: "bg-blue-500/15 border-blue-500/25 text-blue-400",
  recorded: "bg-purple-500/15 border-purple-500/25 text-purple-400",
  posted: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
  cancelled: "bg-red-500/15 border-red-500/25 text-red-400",
};

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  if (platform === "tiktok") return <Music2 className={className} />;
  if (platform === "youtube_shorts") return <Youtube className={className} />;
  return <Instagram className={className} />;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ContentCalendarEntry[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editing, setEditing] = useState<Partial<ContentCalendarEntry> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [eRes, sRes] = await Promise.all([
        fetch("/api/calendar").then((r) => r.json()),
        fetch("/api/scripts").then((r) => r.json()),
      ]);
      setEntries(Array.isArray(eRes) ? eRes : []);
      setScripts(Array.isArray(sRes) ? sRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const monthName = currentMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const entriesByDate = useMemo(() => {
    const map: Record<string, ContentCalendarEntry[]> = {};
    for (const e of entries) {
      const d = e.scheduledDate.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(e);
    }
    return map;
  }, [entries]);

  const navMonth = (delta: number) => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + delta);
    setCurrentMonth(next);
  };

  const openNewEntry = (date: string) => {
    setEditing({
      scheduledDate: date,
      platform: "instagram",
      status: "draft",
      title: "",
    });
  };

  const saveEntry = async () => {
    if (!editing || !editing.scheduledDate || !editing.platform) {
      toast.error("Date and platform required");
      return;
    }
    try {
      if (editing.id) {
        await fetch("/api/calendar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        toast.success("Entry updated");
      } else {
        await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        toast.success("Entry added");
      }
      setEditing(null);
      load();
    } catch {
      toast.error("Failed to save entry");
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this calendar entry?")) return;
    await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setEditing(null);
    toast.success("Entry deleted");
  };

  // Build calendar cells (with leading empty cells for first week)
  const cells: Array<{ date: string | null; dayNum: number | null }> = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ date: null, dayNum: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: formatDate(new Date(year, month, d)), dayNum: d });
  }

  const today = formatDate(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarIcon className="h-8 w-8 text-neon" />
            Content Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan dan jadwalkan konten dari script library Anda
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navMonth(-1)} variant="ghost" className="rounded-xl glass border-white/[0.08] h-10 w-10 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold min-w-[160px] text-center">{monthName}</span>
          <Button onClick={() => navMonth(1)} variant="ghost" className="rounded-xl glass border-white/[0.08] h-10 w-10 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCurrentMonth(new Date())} variant="ghost" className="rounded-xl glass border-white/[0.08] h-10 px-4">
            Today
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-4">
            <div className="grid grid-cols-7 gap-2 text-xs">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-muted-foreground/60 font-semibold py-2 uppercase tracking-widest text-[10px]">
                  {d}
                </div>
              ))}
              {cells.map((cell, i) => {
                const isToday = cell.date === today;
                const dayEntries = cell.date ? entriesByDate[cell.date] || [] : [];
                return (
                  <div
                    key={i}
                    className={`min-h-[110px] rounded-xl border p-2 flex flex-col gap-1 ${
                      cell.date
                        ? `bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] cursor-pointer ${isToday ? "ring-1 ring-neon/40" : ""}`
                        : "bg-transparent border-transparent"
                    }`}
                    onClick={() => cell.date && openNewEntry(cell.date)}
                  >
                    {cell.dayNum && (
                      <div className={`text-xs font-semibold ${isToday ? "text-neon" : ""}`}>{cell.dayNum}</div>
                    )}
                    {dayEntries.slice(0, 2).map((entry) => (
                      <button
                        key={entry.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(entry);
                        }}
                        className={`text-[10px] rounded-md px-1.5 py-1 border text-left truncate ${STATUS_COLORS[entry.status as Status]}`}
                      >
                        <div className="flex items-center gap-1">
                          <PlatformIcon platform={entry.platform} className="h-2 w-2 shrink-0" />
                          <span className="truncate">{entry.title || "(untitled)"}</span>
                        </div>
                      </button>
                    ))}
                    {dayEntries.length > 2 && (
                      <span className="text-[9px] text-muted-foreground/60">+{dayEntries.length - 2} more</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Status Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {(["draft", "recorded", "posted", "cancelled"] as Status[]).map((s) => {
                const count = entries.filter((e) => e.status === s).length;
                return (
                  <div key={s} className={`rounded-xl border p-3 ${STATUS_COLORS[s]}`}>
                    <div className="capitalize font-semibold">{s}</div>
                    <div className="mt-0.5 text-2xl font-bold">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Edit/Create Dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Edit Calendar Entry" : "New Calendar Entry"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                <Input
                  value={editing.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Content title"
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                <Input
                  type="date"
                  value={editing.scheduledDate || ""}
                  onChange={(e) => setEditing({ ...editing, scheduledDate: e.target.value })}
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
                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                  <Select
                    value={editing.status || "draft"}
                    onValueChange={(v) => setEditing({ ...editing, status: v as Status })}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="recorded">Recorded</SelectItem>
                      <SelectItem value="posted">Posted</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
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
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Posted URL (when status = posted)</label>
                <Input
                  value={editing.postedUrl || ""}
                  onChange={(e) => setEditing({ ...editing, postedUrl: e.target.value })}
                  placeholder="https://..."
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <Textarea
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={3}
                  className="rounded-xl"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              {editing.id && (
                <Button
                  variant="ghost"
                  onClick={() => deleteEntry(editing.id!)}
                  className="rounded-xl gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
              <Button onClick={() => setEditing(null)} variant="ghost" className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={saveEntry} className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 font-semibold">
                {editing.id ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
