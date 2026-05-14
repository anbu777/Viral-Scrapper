import { getEnv } from "@/lib/env";
import { generateNewConcepts as geminiGenerate } from "@/lib/gemini";
import { generateNewConcepts as claudeGenerate } from "@/lib/claude";
import { makeFallbackAnalysis, makeFallbackScript, normalizeAnalysis, scoreScript } from "@/lib/quality";
import type { AiProviderName, GeneratedScriptVariant, ScriptVariant, VideoAnalysis } from "@/lib/types";

async function ollama(prompt: string) {
  const env = getEnv();
  const response = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
    }),
  });
  if (!response.ok) throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.response as string;
}

function extractJson(text: string) {
  // Strip markdown fences
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response did not contain JSON");
  // Fix trailing commas before } or ]
  const jsonStr = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(jsonStr);
}

/**
 * Resolves the effective AI provider. If the user asked for Claude but
 * ANTHROPIC_API_KEY is missing, we silently fall back to Gemini so that
 * a free-tier setup never hard-fails.
 */
function effectiveAiProvider(provider: AiProviderName): AiProviderName {
  if (provider === "claude" && !process.env.ANTHROPIC_API_KEY) return "gemini";
  return provider;
}

export async function analyzeWithProvider(input: {
  provider: AiProviderName;
  prompt: string;
  transcript?: string;
  metadataSummary?: string;
  allowFallback?: boolean;
}): Promise<VideoAnalysis> {
  const schemaHint = `Return only JSON with keys: hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience, viralMechanics, riskFlags, sourceEvidence.`;
  const prompt = `${schemaHint}\n\nTranscript:\n${input.transcript || ""}\n\nTask:\n${input.prompt}`;
  const provider = effectiveAiProvider(input.provider);
  try {
    if (provider === "ollama") return normalizeAnalysis(extractJson(await ollama(prompt)));
    if (provider === "gemini") return normalizeAnalysis(extractJson(await geminiGenerate(input.metadataSummary || input.transcript || "", prompt)));
    return normalizeAnalysis(extractJson(await claudeGenerate(input.metadataSummary || input.transcript || "", prompt)));
  } catch (error) {
    if (!input.allowFallback) throw error;
    return makeFallbackAnalysis(input.transcript, input.metadataSummary);
  }
}

export async function generateScriptVariants(input: {
  provider: AiProviderName;
  analysis: VideoAnalysis;
  variants: ScriptVariant[];
  sourceTranscript: string;
  qualityGateMode: "strict" | "balanced" | "off";
  /** Optional brand / voice context (niche, tone, audience) */
  voiceContext?: string;
  allowFallback?: boolean;
}): Promise<GeneratedScriptVariant[]> {
  const variants: GeneratedScriptVariant[] = [];
  const voiceBlock = input.voiceContext?.trim()
    ? `\n\nBrand / voice context (follow closely):\n${input.voiceContext.trim()}\n`
    : "";
  const provider = effectiveAiProvider(input.provider);
  for (const variant of input.variants) {
    let generated = makeFallbackScript(variant, input.analysis);
    try {
      const prompt = `Return only JSON for one ${variant} short-form video script with keys: variant, title, hook, spokenScript, cta, estimatedDurationSeconds, sourceInspiration, similarityScore, qualityScore, imagePrompt, videoPrompt.\n\nAnalysis:\n${JSON.stringify(input.analysis)}${voiceBlock}`;
      const text = provider === "ollama"
        ? await ollama(prompt)
        : provider === "gemini"
          ? await geminiGenerate(JSON.stringify(input.analysis), prompt)
          : await claudeGenerate(JSON.stringify(input.analysis), prompt);
      generated = { ...generated, ...extractJson(text), variant };
    } catch (error) {
      if (!input.allowFallback) throw error;
      // Fallback script still gives free mode a usable output package when explicitly allowed.
    }
    const quality = scoreScript(generated, input.sourceTranscript, input.qualityGateMode);
    variants.push({
      ...generated,
      similarityScore: Number((quality.rubric.similarity as number | undefined) ?? generated.similarityScore),
      qualityScore: quality.score,
    });
  }
  return variants;
}
