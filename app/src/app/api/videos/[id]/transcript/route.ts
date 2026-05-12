import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import { getEnv } from "@/lib/env";
import { getInstagramProvider } from "@/lib/providers";
import { transcribeWithProvider } from "@/lib/transcript-providers";

export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await repo.videos.find(id);
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (video.transcript) return NextResponse.json({ transcript: video.transcript });

    const provider = getInstagramProvider();
    const downloaded = await provider.downloadVideo({ postUrl: video.link, videoFileUrl: video.videoFileUrl });
    const transcript = await transcribeWithProvider({
      provider: getEnv().TRANSCRIPT_PROVIDER,
      videoBuffer: downloaded.buffer,
      contentType: downloaded.contentType,
    });

    await repo.videos.update(id, { transcript });
    return NextResponse.json({ transcript });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
