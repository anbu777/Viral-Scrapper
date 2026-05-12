import { z } from "zod";
import type { GeneratedScriptVariant, QualityScore, ScriptVariant, VideoAnalysis } from "@/lib/types";

export const VideoAnalysisSchema = z.object({
  hook: z.string().default(""),
  summary: z.string().default(""),
  transcript: z.string().default(""),
  ocrText: z.string().default(""),
  visualPattern: z.string().default(""),
  pacing: z.string().default(""),
  formatPattern: z.string().default(""),
  audience: z.string().default(""),
  viralMechanics: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([]),
  sourceEvidence: z.array(z.string()).default([]),
});

export const ScriptVariantSchema = z.object({
  variant: z.enum(["safe", "viral", "brand_voice"]),
  title: z.string().min(1),
  hook: z.string().min(1),
  spokenScript: z.string().min(1),
  cta: z.string().default(""),
  estimatedDurationSeconds: z.number().int().min(1).max(180),
  sourceInspiration: z.string().default(""),
  similarityScore: z.number().min(0).max(1).default(0),
  qualityScore: z.number().min(0).max(100).default(0),
  imagePrompt: z.string().default(""),
  videoPrompt: z.string().default(""),
});

const stopwords = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "is", "it", "for", "you", "i", "this", "that"]);

function tokens(text: string) {
  return text.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => !stopwords.has(token)) ?? [];
}

export function similarityScore(a: string, b: string) {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

export function estimateDurationSeconds(spokenScript: string) {
  const wordCount = spokenScript.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((wordCount / 2.6) * 10) / 10);
}

export function scoreScript(script: GeneratedScriptVariant, sourceTranscript: string, mode: "strict" | "balanced" | "off" = "balanced"): QualityScore {
  if (mode === "off") return { score: 100, status: "passed", rubric: { skipped: true } };
  const similarity = similarityScore(script.spokenScript, sourceTranscript);
  const durationOk = script.estimatedDurationSeconds <= 60;
  const hasHook = script.hook.length >= 8;
  const hasCta = script.cta.length > 0;
  const originalityOk = similarity < (mode === "strict" ? 0.32 : 0.45);

  let score = 0;
  score += hasHook ? 25 : 0;
  score += durationOk ? 25 : 0;
  score += originalityOk ? 30 : 0;
  score += hasCta ? 10 : 5;
  score += script.sourceInspiration ? 10 : 0;

  return {
    score,
    status: score >= 80 ? "passed" : score >= 60 ? "warning" : "failed",
    rubric: {
      hasHook,
      durationOk,
      hasCta,
      originalityOk,
      similarity: Number(similarity.toFixed(4)),
      mode,
    },
  };
}

export function normalizeAnalysis(input: unknown): VideoAnalysis {
  return VideoAnalysisSchema.parse(input);
}

export function makeFallbackAnalysis(transcript = "", summary = ""): VideoAnalysis {
  return {
    hook: transcript.split(/[.!?]/)[0]?.slice(0, 160) || "Hook unavailable",
    summary: summary || "Analysis generated from available metadata only.",
    transcript,
    ocrText: "",
    visualPattern: "Unknown",
    pacing: "Unknown",
    formatPattern: "Unknown",
    audience: "Unknown",
    viralMechanics: [],
    riskFlags: [],
    sourceEvidence: transcript ? ["Transcript"] : ["Metadata"],
  };
}

export function makeFallbackScript(variant: ScriptVariant, analysis: VideoAnalysis): GeneratedScriptVariant {
  const hookMap: Record<ScriptVariant, string> = {
    safe: analysis.hook || "Here is the simple version",
    viral: analysis.hook ? `${analysis.hook} But here is the twist.` : "Most people miss this simple trick.",
    brand_voice: analysis.hook || "Here is what I would tell my audience today.",
  };
  const spokenScript = `${hookMap[variant]} ${analysis.summary || "Turn this idea into a short, useful lesson for your audience."}`.slice(0, 420);
  return {
    variant,
    title: `${variant.replace("_", " ")} concept`,
    hook: hookMap[variant],
    spokenScript,
    cta: "Follow for more.",
    estimatedDurationSeconds: estimateDurationSeconds(spokenScript),
    sourceInspiration: analysis.formatPattern || analysis.summary,
    similarityScore: 0,
    qualityScore: 0,
    imagePrompt: `Vertical 9:16 creator video about: ${analysis.summary || analysis.hook}`,
    videoPrompt: `Natural talking-head motion, confident delivery, clear pacing. Topic: ${analysis.summary || analysis.hook}`,
  };
}
