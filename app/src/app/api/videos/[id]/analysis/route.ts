import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import { getEnv } from "@/lib/env";
import { getInstagramProvider } from "@/lib/providers";
import { analyzeWithProvider } from "@/lib/ai-providers";

export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await repo.videos.find(id);
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (video.analysis) return NextResponse.json({ analysis: video.analysis });

    const config = (await repo.configs.list()).find((c) => c.configName === video.configName);
    const provider = getInstagramProvider();
    const transcript = video.transcript || "";

    if (!transcript && video.videoFileUrl) {
      try {
        await provider.downloadVideo({ postUrl: video.link, videoFileUrl: video.videoFileUrl });
      } catch {
        // Analysis can still proceed from metadata.
      }
    }

    const analysis = await analyzeWithProvider({
      provider: getEnv().AI_PROVIDER,
      prompt: config?.analysisInstruction || "Analyze this short-form video for viral content patterns.",
      transcript,
      metadataSummary: `@${video.creator}, ${video.views} views, ${video.likes} likes, caption: ${video.caption || ""}`,
    });

    await repo.videos.update(id, {
      analysis: JSON.stringify(analysis, null, 2),
      analysisJson: analysis,
      transcript: analysis.transcript || transcript,
    });

    return NextResponse.json({ analysis: JSON.stringify(analysis, null, 2), analysisJson: analysis });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
