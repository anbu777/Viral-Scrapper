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

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object in model output");
  return text.slice(start, end + 1);
}

export type AnalysisOutcome = "ok" | "fallback" | "failed";

export async function analyzeVideoToStructuredJson(input: {
  fileUri: string;
  mimeType: string;
  analysisInstruction: string;
}): Promise<{ analysis: VideoAnalysis; outcome: AnalysisOutcome }> {
  const prompt = `${JSON_ANALYSIS_INSTRUCTION}\n${input.analysisInstruction}`;
  try {
    const raw = await analyzeVideo(input.fileUri, input.mimeType, prompt);
    const parsed = JSON.parse(extractJsonObject(raw));
    const analysis = normalizeAnalysis(parsed);
    VideoAnalysisSchema.parse(analysis);
    return { analysis, outcome: "ok" };
  } catch {
    return {
      analysis: makeFallbackAnalysis("", ""),
      outcome: "fallback",
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
