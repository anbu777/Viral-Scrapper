"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  User,
  ImageIcon,
  CheckCircle2,
  X,
  Pencil,
  Save,
} from "lucide-react";
import type { AvatarProfile } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type AvatarWithRefs = AvatarProfile & { referenceImages: string[] };

// ─── Avatar Card ──────────────────────────────────────────────────────────────

function AvatarCard({
  avatar,
  onUpdated,
}: {
  avatar: AvatarWithRefs;
  onUpdated: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(avatar.name);
  const [gender, setGender] = useState<AvatarProfile["gender"]>(avatar.gender);
  const [niche, setNiche] = useState(avatar.niche);
  const [voiceId, setVoiceId] = useState(avatar.voiceId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    await fetch("/api/avatars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...avatar, id: avatar.id, name, gender, niche, voiceId }),
    });
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
    onUpdated();
  };

  const uploadFiles = async (files: FileList) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/avatars/${avatar.id}/reference`, { method: "POST", body: fd });
    }
    setUploading(false);
    onUpdated();
  };

  const deleteRef = async (filename: string) => {
    setDeleting(filename);
    await fetch(`/api/avatars/${avatar.id}/reference?filename=${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    setDeleting(null);
    onUpdated();
  };

  return (
    <div className="glass rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon/10 border border-neon/20 shrink-0">
            <User className="h-5 w-5 text-neon" />
          </div>
          <div>
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm font-semibold bg-transparent border-b border-neon/50 focus:outline-none text-foreground"
              />
            ) : (
              <h3 className="text-sm font-semibold">{avatar.name}</h3>
            )}
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{avatar.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {saved && <CheckCircle2 className="h-4 w-4 text-green-400" />}
          {editing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={saveProfile}
              disabled={saving}
              className="h-8 rounded-xl gap-1.5 text-xs glass border-white/[0.08] text-green-400 hover:text-green-300"
            >
              {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="h-8 rounded-xl gap-1.5 text-xs glass border-white/[0.08] text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Profile fields (shown when editing) */}
      {editing && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as AvatarProfile["gender"])}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/[0.08] px-3 py-2 text-xs text-foreground focus:outline-none focus:border-neon/50"
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Niche</label>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. Beauty / Lifestyle"
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/[0.08] px-3 py-2 text-xs text-foreground focus:outline-none focus:border-neon/50"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ElevenLabs Voice ID</label>
            <input
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/[0.08] px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-neon/50"
            />
          </div>
        </div>
      )}

      {/* Profile summary (shown when not editing) */}
      {!editing && (
        <div className="flex flex-wrap gap-2">
          {avatar.gender && (
            <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.08]">
              {avatar.gender}
            </Badge>
          )}
          {avatar.niche && (
            <Badge variant="secondary" className="rounded-md text-[10px] bg-neon/10 text-neon border border-neon/20">
              {avatar.niche}
            </Badge>
          )}
          {avatar.voiceId && (
            <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.08] font-mono">
              {avatar.voiceId.slice(0, 12)}…
            </Badge>
          )}
        </div>
      )}

      {/* Reference images section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold">Master Reference Images</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              All uploaded when generating new images — more = better consistency
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-8 shrink-0 rounded-xl gap-1.5 text-xs glass border-white/[0.08] text-neon hover:text-neon"
          >
            {uploading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
        </div>

        {avatar.referenceImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {avatar.referenceImages.map((filename) => (
              <div key={filename} className="relative group aspect-square rounded-xl overflow-hidden bg-black/30 border border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/avatars/${avatar.id}/reference/${encodeURIComponent(filename)}`}
                  alt={filename}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => deleteRef(filename)}
                    disabled={deleting === filename}
                    className="h-7 w-7 rounded-full bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500"
                  >
                    {deleting === filename ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/50">
                  <p className="text-[9px] text-white/60 truncate">{filename}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-white/[0.12] p-6 hover:border-neon/30 hover:bg-neon/5 transition-all group text-center"
          >
            <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/30 group-hover:text-neon/50 transition-colors" />
            <p className="mt-2 text-xs text-muted-foreground">Click to upload reference images</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/50">JPG, PNG, WebP — upload multiple for best results</p>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── New Avatar Modal ─────────────────────────────────────────────────────────

function NewAvatarForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<AvatarProfile["gender"]>("female");
  const [niche, setNiche] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    await fetch("/api/avatars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, gender, niche }),
    });
    setCreating(false);
    setName("");
    setNiche("");
    onCreated();
  };

  return (
    <div className="glass rounded-2xl p-5 border-dashed border-white/[0.1] space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Avatar</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Avatar name (e.g. Mira Voss)"
            className="w-full rounded-xl bg-black/30 border border-white/[0.08] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-neon/50"
          />
        </div>
        <div>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as AvatarProfile["gender"])}
            className="w-full rounded-xl bg-black/30 border border-white/[0.08] px-3 py-2 text-xs text-foreground focus:outline-none focus:border-neon/50"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Niche (e.g. Finance)"
            className="w-full rounded-xl bg-black/30 border border-white/[0.08] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-neon/50"
          />
        </div>
      </div>
      <Button
        onClick={create}
        disabled={!name.trim() || creating}
        className="w-full rounded-xl gap-2 bg-neon text-black hover:bg-neon/90 border-0 font-semibold"
      >
        {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Create Avatar
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvatarsPage() {
  const [avatars, setAvatars] = useState<AvatarWithRefs[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const loadAvatars = async () => {
    setLoading(true);
    const profiles: AvatarProfile[] = await fetch("/api/avatars").then((r) => r.json());
    const withRefs = await Promise.all(
      profiles.map(async (p) => {
        const refs: string[] = await fetch(`/api/avatars/${p.id}/reference`).then((r) => r.json()).catch(() => []);
        return { ...p, referenceImages: refs };
      })
    );
    setAvatars(withRefs);
    setLoading(false);
  };

  useEffect(() => { void Promise.resolve().then(loadAvatars); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading avatars…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Avatars</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage AI avatar identities and their master reference images
          </p>
        </div>
        <Button
          onClick={() => setShowNew((p) => !p)}
          className="rounded-xl gap-2 bg-neon text-black hover:bg-neon/90 border-0 font-semibold"
        >
          <Plus className="h-4 w-4" />
          New Avatar
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-neon/10 border border-neon/20 p-4 text-[12px] text-muted-foreground leading-relaxed space-y-1">
        <p><strong className="text-foreground">Reference images</strong> are uploaded to Higgsfield every time a new video is generated — the more you add, the more consistent the AI keeps the avatar&apos;s identity across different outfits and backgrounds.</p>
        <p>Each avatar uses a separate folder and can have its own ElevenLabs voice ID and niche. Scale to as many avatars as you need.</p>
      </div>

      {/* New avatar form */}
      {showNew && (
        <NewAvatarForm
          onCreated={() => { setShowNew(false); loadAvatars(); }}
        />
      )}

      {/* Avatar grid */}
      {avatars.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {avatars.map((avatar) => (
            <AvatarCard key={avatar.id} avatar={avatar} onUpdated={loadAvatars} />
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-12 text-center">
          <User className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-4 font-semibold">No avatars yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first avatar to get started.</p>
          <Button
            onClick={() => setShowNew(true)}
            className="mt-6 rounded-xl bg-neon text-black hover:bg-neon/90 border-0 font-semibold"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Avatar
          </Button>
        </div>
      )}
    </div>
  );
}
