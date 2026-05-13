import { NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/db/repositories";
import { createPipelineRun } from "@/lib/pipeline-runs";

const PipelineRunSchema = z.object({
  configName: z.string().min(1),
  maxVideos: z.number().int().min(1).max(100).default(20),
  topK: z.number().int().min(1).max(20).default(3),
  nDays: z.number().int().min(1).max(365).default(30),
  scraperProvider: z.enum(["local", "apify", "manual", "meta", "tiktok", "youtube"]).optional(),
  aiProvider: z.enum(["ollama", "gemini", "claude"]).optional(),
  transcriptProvider: z.enum(["whisper-local", "gemini"]).optional(),
  videoProvider: z.enum(["none", "fal"]).optional(),
  freeMode: z.boolean().default(true),
  scriptVariants: z.array(z.enum(["safe", "viral", "brand_voice"])).optional(),
  maxConcurrency: z.number().int().min(1).max(10).optional(),
  qualityGateMode: z.enum(["strict", "balanced", "off"]).optional(),
  autoAnalysis: z.boolean().optional(),
  autoTranscript: z.boolean().optional(),
  autoGenerateScripts: z.boolean().optional(),
  autoGenerateVideos: z.boolean().optional(),
  skipScraping: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json(await repo.runs.list());
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = PipelineRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const run = await createPipelineRun(parsed.data);
  return NextResponse.json(run, { status: 202 });
}
