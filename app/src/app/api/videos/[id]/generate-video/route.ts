import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { avatarId?: string; duration?: number };
  const avatarId = body.avatarId ?? "default";
  const duration = body.duration ?? 10;

  try {
    const { readVideos, readScripts, writeScripts, updateScript } = await import("@/lib/csv");
    const { generateNanoBananaPro, submitKling3Video } = await import("@/lib/fal");
    const { saveGeneratedImage, listReferenceImages, readReferenceImage, readAvatar } = await import("@/lib/avatar");
    const { generateFilledPromptsFromVideo } = await import("@/lib/promptgen");

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not set in .env.local — get it at fal.ai/dashboard" }, { status: 500 });
    }

    const videos = readVideos();
    const video = videos.find((v) => v.id === id);
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

    const avatarProfile = readAvatar(avatarId);

    console.log(`[videos/generate-video] Cloning @${video.creator} with avatar "${avatarId}" (${duration}s)`);

    // Generate prompts from video analysis
    const filled = await generateFilledPromptsFromVideo(video, avatarProfile);

    // Create a Script record so the existing video-status polling works
    const scriptId = uuid();
    const newScript = {
      id: scriptId,
      videoId: video.id,
      videoCreator: video.creator,
      videoViews: video.views,
      videoLink: video.link,
      title: `@${video.creator} style clone`,
      hook: filled.dialogue,
      script: filled.dialogue,
      platform: "instagram",
      estimatedDuration: `${duration}s`,
      contentType: "Video Clone",
      dateGenerated: new Date().toISOString().slice(0, 10),
      starred: false,
      videoStatus: "processing" as const,
      avatarId,
      imagePrompt: filled.imagePrompt,
      videoPrompt: filled.videoPrompt,
      // Store the direct CDN URL of the source video so video-status can extract its audio for lipsync
      sourceVideoUrl: video.videoFileUrl || undefined,
    };

    const existing = readScripts();
    writeScripts([...existing, newScript]);

    // Load avatar reference images for identity-locked generation
    const refFilenames = listReferenceImages(avatarId);
    const referenceImages = refFilenames.slice(0, 4).map((filename) => {
      const buffer = readReferenceImage(avatarId, filename);
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return { buffer, mimeType };
    });

    if (referenceImages.length > 0) {
      console.log(`[videos/generate-video] Using ${referenceImages.length} reference image(s)`);
    } else {
      console.warn(`[videos/generate-video] No reference images for avatar "${avatarId}"`);
    }

    // Generate avatar image (Nano Banana Pro)
    console.log(`[videos/generate-video] Generating image (Nano Banana Pro)...`);
    const avatarImageUrl = await generateNanoBananaPro(
      filled.imagePrompt,
      referenceImages.length > 0 ? referenceImages : undefined
    );

    // Save local copy
    try {
      const buf = Buffer.from(await (await fetch(avatarImageUrl)).arrayBuffer());
      saveGeneratedImage(avatarId, scriptId, buf);
    } catch { /* best effort */ }

    // Submit Kling 3.0 video job
    console.log(`[videos/generate-video] Submitting Kling 3.0 job (${duration}s, ${filled.framing}, ${filled.actionType})...`);
    const videoJobId = await submitKling3Video(avatarImageUrl, filled.videoPrompt, duration, filled.negativePrompt);

    updateScript(scriptId, {
      videoJobId,
      videoStatus: "processing",
      videoProvider: "fal",
      videoMode: "kling3",
      generatedImageUrl: avatarImageUrl,
    });

    return NextResponse.json({ success: true, scriptId, jobId: videoJobId });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[videos/generate-video] ERROR:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
