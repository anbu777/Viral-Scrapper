"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Settings2,
  Sparkles,
  Search,
  Users,
  Film,
  AlertCircle,
  CheckCircle2,
  Play,
  Wand2,
} from "lucide-react";
import { ConfigListSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Config, Creator, Video } from "@/lib/types";
import type { PromptTemplate, NicheKey } from "@/lib/prompt-templates";

const emptyConfig = {
  configName: "",
  creatorsCategory: "",
  analysisInstruction: "",
  newConceptsInstruction: "",
};

export default function ConfigsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Config | null>(null);
  const [form, setForm] = useState(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfigs = () => {
    fetch("/api/configs")
      .then((r) => r.json())
      .then((d) => setConfigs(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/configs").then((r) => r.json()).then((d) => setConfigs(Array.isArray(d) ? d : [])),
      fetch("/accounts-data").then((r) => r.json()).then((d) => setCreators(Array.isArray(d) ? d : [])),
      fetch("/api/videos").then((r) => r.json()).then((d) => setVideos(Array.isArray(d) ? d : [])),
      fetch("/api/prompt-templates").then((r) => r.json()).then((d) => setTemplates(Array.isArray(d) ? d : [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allCategories = useMemo(() => {
    return [...new Set(creators.map((c) => c.category).filter(Boolean))].sort();
  }, [creators]);

  const matchingCreatorsCount = useMemo(() => {
    if (!form.creatorsCategory) return 0;
    return creators.filter((c) => c.category.toLowerCase() === form.creatorsCategory.toLowerCase()).length;
  }, [form.creatorsCategory, creators]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyConfig);
    setDialogOpen(true);
  };

  const openEdit = (config: Config) => {
    setEditing(config);
    setForm({
      configName: config.configName,
      creatorsCategory: config.creatorsCategory,
      analysisInstruction: config.analysisInstruction,
      newConceptsInstruction: config.newConceptsInstruction,
    });
    setDialogOpen(true);
  };

  const applyTemplate = (niche: NicheKey) => {
    const template = templates.find((t) => t.niche === niche);
    if (!template) return;
    setForm((prev) => ({
      ...prev,
      analysisInstruction: template.analysisPrompt,
      newConceptsInstruction: template.conceptsPrompt,
    }));
    toast.success("Template applied", `Loaded "${template.label}" prompts. You can still customize them.`);
  };

  const handleSave = async () => {
    if (!form.configName.trim() || !form.creatorsCategory.trim()) {
      toast.error("Required fields missing", "Config name and category are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await fetch("/api/configs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
        toast.success("Config updated", `"${form.configName}" saved successfully`);
      } else {
        await fetch("/api/configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast.success("Config created", `"${form.configName}" is ready to use`);
      }
      setDialogOpen(false);
      loadConfigs();
    } catch {
      toast.error("Save failed", "Please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (config: Config) => {
    if (!confirm(`Delete "${config.configName}"? This will also delete all videos linked to it.`)) return;
    await fetch(`/api/configs?id=${config.id}`, { method: "DELETE" });
    toast.success("Config deleted", `"${config.configName}" was removed`);
    loadConfigs();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pipeline configurations connect creators to AI prompts
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-1.5 font-semibold">
              <Plus className="h-4 w-4" />
              New Config
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-white/[0.08]">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Config" : "New Config"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Config Name</Label>
                <Input
                  value={form.configName}
                  onChange={(e) => setForm({ ...form, configName: e.target.value })}
                  placeholder="e.g. Crypto Finance Global"
                  className="mt-1.5 rounded-xl glass border-white/[0.08] h-11"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Creators Category</Label>
                <div className="mt-1.5 relative">
                  <Input
                    value={form.creatorsCategory}
                    onChange={(e) => setForm({ ...form, creatorsCategory: e.target.value })}
                    placeholder="e.g. crypto, finance, ai-creator"
                    className="rounded-xl glass border-white/[0.08] h-11"
                    list="categories-list"
                  />
                  <datalist id="categories-list">
                    {allCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                {form.creatorsCategory && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {matchingCreatorsCount > 0 ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">
                          {matchingCreatorsCount} creator{matchingCreatorsCount !== 1 ? "s" : ""} match this category
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-amber-400">
                          No creators match yet. Add creators with category &quot;{form.creatorsCategory}&quot;
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Template Selector */}
              <div className="rounded-xl border border-neon/20 bg-neon/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-neon" />
                  <p className="text-xs font-semibold">Use Template (Optional)</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Skip writing prompts from scratch — pick a niche template and customize it.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.niche}
                      type="button"
                      onClick={() => applyTemplate(tpl.niche)}
                      className="rounded-lg p-2.5 text-left border border-white/[0.06] hover:border-neon/30 hover:bg-neon/5 transition-all"
                    >
                      <p className="text-xs font-medium">{tpl.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="h-3 w-3 text-neon" />
                  Analysis Instruction (Gemini prompt)
                </Label>
                <Textarea
                  value={form.analysisInstruction}
                  onChange={(e) => setForm({ ...form, analysisInstruction: e.target.value })}
                  placeholder="Tell the AI what to look for when analyzing each video..."
                  rows={8}
                  className="mt-1.5 rounded-xl glass border-white/[0.08] font-mono text-xs leading-relaxed"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-neon-muted" />
                  New Concepts Instruction (script generation prompt)
                </Label>
                <Textarea
                  value={form.newConceptsInstruction}
                  onChange={(e) => setForm({ ...form, newConceptsInstruction: e.target.value })}
                  placeholder="Tell the AI how to adapt the analyzed video for your brand..."
                  rows={8}
                  className="mt-1.5 rounded-xl glass border-white/[0.08] font-mono text-xs leading-relaxed"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !form.configName || !form.creatorsCategory}
                className="w-full rounded-xl h-11 bg-neon text-black hover:bg-neon/90 border-0 font-semibold"
              >
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Config"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Config Cards */}
      {loading ? (
        <ConfigListSkeleton />
      ) : (
        <div className="grid gap-4">
          {configs.map((config) => {
            const matching = creators.filter(
              (c) => c.category.toLowerCase() === config.creatorsCategory.toLowerCase()
            );
            const videoCount = videos.filter((v) => v.configName === config.configName).length;
            const hasIssues = matching.length === 0;

            return (
              <div
                key={config.id}
                className={`glass rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.05] ${
                  hasIssues ? "border-amber-500/20" : "hover:border-white/[0.1]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon/10 border border-neon/20">
                      <Settings2 className="h-4 w-4 text-neon" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold">{config.configName}</h3>
                        {hasIssues && (
                          <Badge
                            variant="secondary"
                            className="rounded-md text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400"
                          >
                            <AlertCircle className="h-2.5 w-2.5 mr-1" />
                            No creators match
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]"
                        >
                          {config.creatorsCategory}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {matching.length} creator{matching.length !== 1 ? "s" : ""}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Film className="h-3 w-3" />
                          {videoCount} video{videoCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {!hasIssues && (
                      <Link href={`/run?config=${encodeURIComponent(config.configName)}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg h-8 gap-1.5 text-xs glass border border-white/[0.06] text-neon hover:bg-neon/5"
                        >
                          <Play className="h-3 w-3" />
                          Run
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(config)}
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(config)}
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Creator avatars preview */}
                {matching.length > 0 && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {matching.slice(0, 5).map((c) => (
                        <div
                          key={c.id}
                          className="h-7 w-7 rounded-full border-2 border-background bg-gradient-to-br from-neon/20 to-emerald-500/20 flex items-center justify-center text-[10px] font-bold"
                          title={`@${c.username}`}
                        >
                          {c.username.slice(0, 2).toUpperCase()}
                        </div>
                      ))}
                      {matching.length > 5 && (
                        <div className="h-7 w-7 rounded-full border-2 border-background bg-white/[0.05] flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                          +{matching.length - 5}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {matching.map((c) => `@${c.username}`).join(", ")}
                    </span>
                  </div>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-black/20 border border-white/[0.04] p-3">
                    <p className="text-[10px] font-medium text-neon uppercase tracking-wider mb-1.5">
                      Analysis Prompt
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {config.analysisInstruction || "No prompt set"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-black/20 border border-white/[0.04] p-3">
                    <p className="text-[10px] font-medium text-neon-muted uppercase tracking-wider mb-1.5">
                      Concepts Prompt
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {config.newConceptsInstruction || "No prompt set"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {configs.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center">
              <Settings2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <h3 className="mt-4 font-semibold">No configs yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create one to get started.</p>
              <Button
                onClick={openNew}
                className="mt-4 rounded-xl bg-neon text-black hover:bg-neon/90 border-0 gap-2 font-semibold"
              >
                <Plus className="h-4 w-4" />
                Create First Config
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
