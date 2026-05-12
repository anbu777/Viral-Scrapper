"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mic,
  Sparkles,
  Save,
  Info,
  Plus,
  User,
  CheckCircle2,
  Loader2,
  ImagePlus,
} from "lucide-react";
import type { VoiceProfile, AvatarProfile } from "@/lib/types";

const emptyProfile: VoiceProfile = {
  niche: "Business / Finance",
  tone: "",
  targetAudience: "",
  phrases: "",
  avoidPhrases: "",
  contentGoal: "",
  cta: "",
  sampleContent: "",
  heygenAvatarStyle: "professional presenter",
  avatarUrls: [],
};

// ─── New Avatar Dialog ────────────────────────────────────────────────────────

function NewAvatarDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (avatar: AvatarProfile) => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<AvatarProfile["gender"]>("female");
  const [niche, setNiche] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), gender, niche }),
      });
      const avatar = await res.json() as AvatarProfile;
      onCreate(avatar);
      setName("");
      setNiche("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md glass-strong rounded-2xl border-white/[0.08] p-6 gap-0">
        <DialogTitle className="text-base font-semibold mb-4">New Avatar</DialogTitle>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sofia — Business Coach"
              className="mt-1.5 rounded-xl glass border-white/[0.08] h-10"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Gender</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as AvatarProfile["gender"])}>
              <SelectTrigger className="mt-1.5 rounded-xl glass border-white/[0.08] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Niche (optional)</Label>
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. Real Estate, Beauty, Finance"
              className="mt-1.5 rounded-xl glass border-white/[0.08] h-10"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="flex-1 rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Avatar
            </Button>
            <Button variant="ghost" onClick={onClose} className="rounded-xl glass border-white/[0.06]">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VoiceProfilePage() {
  const [avatars, setAvatars] = useState<AvatarProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<VoiceProfile>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [refSaved, setRefSaved] = useState(false);

  // Load avatars on mount
  useEffect(() => {
    fetch("/api/avatars")
      .then((r) => r.json())
      .then((data: AvatarProfile[]) => {
        setAvatars(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load voice profile + reference images whenever selection changes
  const loadAvatar = useCallback(async (id: string) => {
    setLoading(true);
    setSaved(false);
    try {
      const [vpRes, refRes] = await Promise.all([
        fetch(`/api/avatars/${id}/voice-profile`).then((r) => r.json()) as Promise<VoiceProfile>,
        fetch(`/api/avatars/${id}/reference`).then((r) => r.json()) as Promise<string[]>,
      ]);
      setProfile(vpRes);
      setRefImages(refRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadAvatar(selectedId);
  }, [selectedId, loadAvatar]);

  const set = (key: keyof VoiceProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    await fetch(`/api/avatars/${selectedId}/voice-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedId) return;
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingRef(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/avatars/${selectedId}/reference`, { method: "POST", body: fd });
      }
      // Reload reference list
      const updated = await fetch(`/api/avatars/${selectedId}/reference`).then((r) => r.json()) as string[];
      setRefImages(updated);
      setRefSaved(true);
      setTimeout(() => setRefSaved(false), 3000);
    } finally {
      setUploadingRef(false);
      e.target.value = "";
    }
  };

  const handleDeleteRef = async (filename: string) => {
    if (!selectedId) return;
    await fetch(`/api/avatars/${selectedId}/reference?filename=${encodeURIComponent(filename)}`, { method: "DELETE" });
    setRefImages((prev) => prev.filter((f) => f !== filename));
  };

  const selectedAvatar = avatars.find((a) => a.id === selectedId);

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon/10 border border-neon/20">
              <Mic className="h-4 w-4 text-neon" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Avatar Profiles</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Each avatar has its own voice, niche, and reference images. Select an avatar to edit its profile.
          </p>
        </div>
        <Button
          onClick={() => setShowNewDialog(true)}
          className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 shrink-0 font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          New Avatar
        </Button>
      </div>

      {/* Avatar Selector */}
      {avatars.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center border border-dashed border-white/[0.08]">
          <User className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No avatars yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first avatar to get started.</p>
          <Button
            onClick={() => setShowNewDialog(true)}
            className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Avatar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {avatars.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => setSelectedId(avatar.id)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all text-left ${
                selectedId === avatar.id
                  ? "bg-neon/15 border-neon/40 text-foreground"
                  : "glass border-white/[0.06] text-muted-foreground hover:border-white/[0.12] hover:text-foreground"
              }`}
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-neon/15 to-emerald-500/15 border border-white/[0.08] flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-neon" />
              </div>
              <div>
                <p className="text-xs font-semibold leading-tight">{avatar.name}</p>
                {avatar.niche && <p className="text-[10px] text-muted-foreground mt-0.5">{avatar.niche}</p>}
              </div>
              {selectedId === avatar.id && (
                <CheckCircle2 className="h-3.5 w-3.5 text-neon ml-1" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Selected Avatar Editor */}
      {selectedId && selectedAvatar && (
        <>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading profile…
            </div>
          ) : (
            <>
              {/* Reference Images */}
              <div className="glass rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-2">
                      <ImagePlus className="h-3 w-3 text-neon" />
                      Reference Images
                      <span className="font-normal normal-case text-green-400/90 bg-green-500/10 border border-green-500/20 rounded-md px-1.5 py-0.5 text-[10px]">
                        Used for identity-locked image generation
                      </span>
                    </Label>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Upload face/body shots of <strong className="text-foreground/70">{selectedAvatar.name}</strong>. These are passed to Nano Banana Pro to keep the avatar visually consistent across all generated videos.
                    </p>
                  </div>
                </div>

                {/* Image grid */}
                <div className="flex flex-wrap gap-3">
                  {refImages.map((filename, i) => (
                    <div key={filename} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/avatars/${selectedId}/reference/${encodeURIComponent(filename)}`}
                        alt={`Ref ${i + 1}`}
                        className="h-20 w-20 rounded-xl object-cover border border-white/[0.08]"
                      />
                      {i === 0 && (
                        <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-neon text-[9px] font-bold flex items-center justify-center text-white">1</span>
                      )}
                      <button
                        onClick={() => handleDeleteRef(filename)}
                        className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-red-400 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ))}

                  {/* Upload button */}
                  <label className="h-20 w-20 rounded-xl border border-dashed border-white/[0.12] flex flex-col items-center justify-center cursor-pointer hover:border-neon/30 transition-colors gap-1">
                    {uploadingRef ? (
                      <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-5 w-5 text-muted-foreground/50" />
                        <span className="text-[9px] text-muted-foreground/50">Add</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={handleRefUpload}
                      disabled={uploadingRef}
                    />
                  </label>
                </div>

                {refSaved && (
                  <p className="text-xs text-green-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" /> Images saved!
                  </p>
                )}
                {refImages.length === 0 && (
                  <p className="text-[11px] text-amber-400/80">
                    No reference images yet — upload at least 1 face photo for consistent avatar generation.
                  </p>
                )}
              </div>

              {/* Info banner */}
              <div className="glass rounded-xl p-4 flex items-start gap-3 border border-neon/20 bg-neon/5">
                <Info className="h-4 w-4 text-neon mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This voice profile is used every time a script is generated for <strong className="text-foreground/70">{selectedAvatar.name}</strong>. The more detail you add, the more the scripts will sound like this avatar.
                </p>
              </div>

              {/* Voice Profile Form */}
              <div className="glass rounded-2xl p-6 space-y-6">
                <h2 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                  <Mic className="h-4 w-4 text-neon" />
                  Voice & Content Profile — {selectedAvatar.name}
                </h2>

                <div>
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Niche</Label>
                  <Select value={profile.niche} onValueChange={(v) => set("niche", v)}>
                    <SelectTrigger className="mt-2 rounded-xl glass border-white/[0.08] h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beauty / Lifestyle">Beauty / Lifestyle</SelectItem>
                      <SelectItem value="Business / Finance">Business / Finance</SelectItem>
                      <SelectItem value="Real Estate">Real Estate</SelectItem>
                      <SelectItem value="Personal Brand / Coaching">Personal Brand / Coaching</SelectItem>
                      <SelectItem value="E-commerce / Products">E-commerce / Products</SelectItem>
                      <SelectItem value="Health & Fitness">Health &amp; Fitness</SelectItem>
                      <SelectItem value="Tech / SaaS">Tech / SaaS</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tone / Style</Label>
                  <Input
                    value={profile.tone}
                    onChange={(e) => set("tone", e.target.value)}
                    placeholder="e.g. authoritative but relatable, straight-to-the-point, no fluff"
                    className="mt-2 rounded-xl glass border-white/[0.08] h-11"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Target Audience</Label>
                  <Input
                    value={profile.targetAudience}
                    onChange={(e) => set("targetAudience", e.target.value)}
                    placeholder="e.g. Entrepreneurs 25–40, aspiring investors, side-hustle builders"
                    className="mt-2 rounded-xl glass border-white/[0.08] h-11"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Phrases Always Used</Label>
                  <Input
                    value={profile.phrases}
                    onChange={(e) => set("phrases", e.target.value)}
                    placeholder='e.g. "let me break this down", "here&apos;s the truth"'
                    className="mt-2 rounded-xl glass border-white/[0.08] h-11"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Comma-separated.</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Phrases to NEVER Use</Label>
                  <Input
                    value={profile.avoidPhrases}
                    onChange={(e) => set("avoidPhrases", e.target.value)}
                    placeholder='e.g. "hustle culture", corporate jargon'
                    className="mt-2 rounded-xl glass border-white/[0.08] h-11"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Content Goal</Label>
                  <Input
                    value={profile.contentGoal}
                    onChange={(e) => set("contentGoal", e.target.value)}
                    placeholder="e.g. Build authority, grow followers, drive DMs to coaching program"
                    className="mt-2 rounded-xl glass border-white/[0.08] h-11"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Preferred CTA</Label>
                  <Input
                    value={profile.cta}
                    onChange={(e) => set("cta", e.target.value)}
                    placeholder='e.g. "Follow for daily tips", "DM me MONEY for the free guide"'
                    className="mt-2 rounded-xl glass border-white/[0.08] h-11"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-neon" />
                    Avatar Style
                  </Label>
                  <Select value={profile.heygenAvatarStyle} onValueChange={(v) => set("heygenAvatarStyle", v)}>
                    <SelectTrigger className="mt-2 rounded-xl glass border-white/[0.08] h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional presenter">Professional Presenter (formal, confident)</SelectItem>
                      <SelectItem value="casual talker">Casual Talker (relaxed, conversational)</SelectItem>
                      <SelectItem value="energetic speaker">Energetic Speaker (fast-paced, motivational)</SelectItem>
                      <SelectItem value="documentary narrator">Documentary Narrator (measured, authoritative)</SelectItem>
                      <SelectItem value="friendly educator">Friendly Educator (warm, clear, step-by-step)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Sample Content
                    <span className="ml-1.5 font-normal">(most important — teaches the AI this avatar&apos;s voice)</span>
                  </Label>
                  <Textarea
                    value={profile.sampleContent}
                    onChange={(e) => set("sampleContent", e.target.value)}
                    placeholder={`Paste 3–5 sentences this avatar has already recorded or written. The AI will mirror their exact word choice, rhythm, and energy.\n\nExample:\n"Most people think building wealth is about earning more. It's not. It's about controlling where your money goes. Here's the 3-account system I used to go from broke to my first $100K."`}
                    rows={7}
                    className="mt-2 rounded-xl glass border-white/[0.08] font-mono text-xs leading-relaxed"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3 pb-8">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold px-6"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving…" : `Save Profile — ${selectedAvatar.name}`}
                </Button>
                {saved && (
                  <span className="text-sm text-green-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Saved!
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      <NewAvatarDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onCreate={(avatar) => {
          setAvatars((prev) => [...prev, avatar]);
          setSelectedId(avatar.id);
        }}
      />
    </div>
  );
}
