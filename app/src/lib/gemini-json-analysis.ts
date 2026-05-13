import { analyzeVideo } from "@/lib/gemini";
import { VideoAnalysisSchema, makeFallbackAnalysis, normalizeAnalysis } from "@/lib/quality";
import type { VideoAnalysis } from "@/lib/types";

const JSON_ANALYSIS_INSTRUCTION = `You are analyzing a short-form vertical video. Output ONLY valid JSON (no markdown fences) with exactly these keys:
hook, summary, transcript, ocrText, visualPattern, pacing, formatPattern, audience, viralMechanics, riskFlags, sourceEvidence.
- hook: string, first attention line if spoken or on-screen.
- summary: string, 2-4 sentences.
- transcript: string, every spoken word verbatim; if none, "".
- ocrText: string, important on-screen text or "".
- visualPattern, pacing, formatPattern, audience: strings.
- viralMechanics: array of short strings.
- riskFlags: array of short strings (e.g. claims, sensitive topics).
- sourceEvidence: array of short strings citing what you saw/heard.

Task and style guidance (apply strictly):
`;

/**
 * Extracts a JSON object from raw text, handling markdown fences and
 * other common wrapping that Gemini sometimes adds.
 */
function extractJsonObject(text: string): string {
  // Strip markdown fences first
  let cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");
  
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object in model output");
  cleaned = cleaned.slice(start, end + 1);
  
  // Fix common JSON issues: trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  
  return cleaned;
}

export type AnalysisOutcome = "ok" | "fallback" | "failed";

export async function analyzeVideoToStructuredJson(input: {
  fileUri: string;
  mimeType: string;
  analysisInstruction: string;
}): Promise<{ analysis: VideoAnalysis; outcome: AnalysisOutcome; error?: string }> {
  const prompt = `${JSON_ANALYSIS_INSTRUCTION}\n${input.analysisInstruction}`;
  try {
    const raw = await analyzeVideo(input.fileUri, input.mimeType, prompt);
    
    // Detect Gemini safety/recitation blocks that return empty text
    if (!raw || !raw.trim()) {
      console.warn("[gemini-json-analysis] Gemini returned empty response — possible safety block");
      return {
        analysis: makeFallbackAnalysis("", "Video blocked by Gemini safety filters."),
        outcome: "fallback",
        error: "Gemini returned empty response (video may have been blocked by safety filters). Try re-importing or using a different video.",
      };
    }
    
    const jsonStr = extractJsonObject(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      // JSON parse failure — return fallback instead of throwing
      // This handles cases where Gemini returns text that isn't valid JSON
      console.warn(`[gemini-json-analysis] JSON parse failed, using fallback. Snippet: ${jsonStr.slice(0, 200)}`);
      return {
        analysis: makeFallbackAnalysis("", "Gemini returned non-JSON response."),
        outcome: "fallback",
        error: `Failed to parse Gemini JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      };
    }
    
    const analysis = normalizeAnalysis(parsed);
    VideoAnalysisSchema.parse(analysis);
    return { analysis, outcome: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // "No JSON object in model output" — Gemini returned plain text, use fallback
    if (/No JSON object|did not contain JSON/i.test(message)) {
      console.warn(`[gemini-json-analysis] ${message} — using fallback analysis`);
      return {
        analysis: makeFallbackAnalysis("", "AI response did not contain structured JSON."),
        outcome: "fallback",
        error: message,
      };
    }
    // Network/rate errors should propagate for retry by withBackoff
    if (/429|503|502|504|timeout|ECONNRESET|fetch failed|rate|quota/i.test(message)) {
      throw error;
    }
    // All other errors — return fallback gracefully
    console.warn(`[gemini-json-analysis] Unexpected error, using fallback: ${message}`);
    return {
      analysis: makeFallbackAnalysis("", `Analysis error: ${message}`),
      outcome: "fallback",
      error: message,
    };
  }
}

export async function transcribeVideoWithGemini(fileUri: string, mimeType: string): Promise<string> {
  const prompt =
    'Transcribe every single word spoken in this video, word for word. Output ONLY a JSON object with a single key "transcript" whose value is the raw spoken text. If nothing is spoken, use "".';
  const raw = await analyzeVideo(fileUri, mimeType, prompt);
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as { transcript?: string };
    return typeof parsed.transcript === "string" ? parsed.transcript : "";
  } catch {
    const plain = raw.replace(/^\s*#+\s*/gm, "").trim();
    return plain.slice(0, 20_000);
  }
}
