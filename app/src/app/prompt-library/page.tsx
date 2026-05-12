"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Sparkles,
  ImageIcon,
  Video,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { PromptLibrary } from "@/lib/types";

const DEFAULT_LIBRARY: PromptLibrary = {
  imagePromptTemplate: "",
  videoPromptTemplate: "",
};

function TemplateEditor({
  label,
  icon: Icon,
  value,
  onChange,
  variables,
  hint,
  rows = 7,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  variables: string[];
  hint: string;
  rows?: number;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neon/10 border border-neon/20">
            <Icon className="h-4 w-4 text-neon" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-wrap justify-end">
            {variables.map((v) => (
              <Badge
                key={v}
                variant="secondary"
                className="rounded-md text-[10px] bg-neon/10 text-neon border border-neon/20 font-mono"
              >
                {`{${v}}`}
              </Badge>
            ))}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className="w-full rounded-xl bg-black/30 border border-white/[0.08] px-4 py-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-neon/50 resize-y font-mono leading-relaxed"
            placeholder="Paste your full prompt template here. Include your avatar's fixed identity description, then use {variable} placeholders for the parts Claude will fill in."
          />
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground/60">
            <span>Variables Claude will fill:</span>
            {variables.map((v) => (
              <code key={v} className="text-neon/80 bg-neon/10 rounded px-1.5 py-0.5">{`{${v}}`}</code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewPanel({ library }: { library: PromptLibrary }) {
  const sample = {
    outfit: "casual white ribbed crop top and high-waist beige linen trousers",
    background: "aesthetic minimal bedroom studio with warm soft lighting",
    motion: "natural slight head tilt while speaking, occasional glance down thoughtfully, subtle shoulder movement",
    dialogue: "Wait — this one tip completely changed my morning routine.",
  };

  function fill(template: string) {
    return template.replace(/\{(\w+)\}/g, (_, key) => (sample as Record<string, string>)[key] ?? `{${key}}`);
  }

  const hasImage = !!library.imagePromptTemplate;
  const hasVideo = !!library.videoPromptTemplate;

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">Sample values — Claude generates these per script</p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-neon uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="h-3 w-3" /> Image Prompt
          </p>
          <div className="rounded-xl bg-black/30 border border-white/[0.04] p-3 max-h-32 overflow-y-auto">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {hasImage ? fill(library.imagePromptTemplate) : (
                <span className="italic text-muted-foreground/40">No template set yet</span>
              )}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Video className="h-3 w-3" /> Video Prompt (sent to Higgsfield)
          </p>
          <div className="rounded-xl bg-black/30 border border-white/[0.04] p-3 max-h-40 overflow-y-auto">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {hasVideo ? fill(library.videoPromptTemplate) : (
                <span className="italic text-muted-foreground/40">No template set yet</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-black/20 border border-white/[0.04] p-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sample values used above</p>
        {Object.entries(sample).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-[11px]">
            <code className="text-neon/70 shrink-0">{`{${k}}`}</code>
            <span className="text-muted-foreground/60 truncate">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PromptLibraryPage() {
  const [library, setLibrary] = useState<PromptLibrary>(DEFAULT_LIBRARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/prompt-library")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setLibrary(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/prompt-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(library),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const update = (key: keyof PromptLibrary, val: string) => {
    setSaved(false);
    setLibrary((prev) => ({ ...prev, [key]: val }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prompt Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your avatar&apos;s identity-locked templates — Claude fills the variables per script
          </p>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="rounded-xl gap-2 bg-neon text-black hover:bg-neon/90 border-0 font-semibold"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving…" : saved ? "Saved!" : "Save Templates"}
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-neon/10 border border-neon/20 p-4 flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-neon mt-0.5 shrink-0" />
        <div className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
          <p><strong className="text-foreground">How it works:</strong> Paste your full prompt here with your avatar&apos;s fixed identity description (face, body, skin tone, hair — everything that stays the same). Use <code className="text-neon/80">{`{outfit}`}</code>, <code className="text-neon/80">{`{background}`}</code>, etc. as placeholders for what changes per video.</p>
          <p>When you click &ldquo;Generate Video&rdquo; on a script, Claude reads the script content and your Voice Profile, then generates context-appropriate values for each variable — no presets needed, works for any avatar.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: templates */}
        <div className="space-y-5">
          <TemplateEditor
            label="Image Generation Prompt"
            icon={ImageIcon}
            value={library.imagePromptTemplate}
            onChange={(v) => update("imagePromptTemplate", v)}
            variables={["outfit", "background"]}
            hint="For Nano Banana Pro or any image AI — lock identity, vary context"
            rows={8}
          />

          <TemplateEditor
            label="Video Motion Prompt"
            icon={Video}
            value={library.videoPromptTemplate}
            onChange={(v) => update("videoPromptTemplate", v)}
            variables={["outfit", "background", "motion", "dialogue"]}
            hint="Sent to Higgsfield Kling 3.0 — controls avatar motion and spoken dialogue"
            rows={8}
          />

          <div className="glass rounded-2xl p-5 space-y-4">
            <p className="text-sm font-semibold">What Claude generates per script</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { var: "{outfit}", desc: "Clothing that fits the script topic and niche vibe" },
                { var: "{background}", desc: "Scene that matches the mood and content type" },
                { var: "{motion}", desc: "Natural UGC body language for the delivery style" },
                { var: "{dialogue}", desc: "1–2 sentence hook excerpt, max 25 words" },
              ].map(({ var: v, desc }) => (
                <div key={v} className="rounded-xl bg-black/20 border border-white/[0.04] p-3">
                  <code className="text-[11px] text-neon font-mono">{v}</code>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              Claude also reads your <a href="/voice-profile" className="text-neon/80 hover:text-neon underline underline-offset-2">Voice Profile</a> (niche, tone, audience) to make variables match your brand.
            </p>
          </div>
        </div>

        {/* Right: live preview */}
        <div>
          <PreviewPanel library={library} />
        </div>
      </div>
    </div>
  );
}
