import { NextRequest, NextResponse } from "next/server";

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
    const { readScripts, updateScript } = await import("@/lib/csv");
    const { generateNanoBananaPro, submitKling3Video } = await import("@/lib/fal");
    const { saveGeneratedImage } = await import("@/lib/avatar");

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not set in .env.local — get it at fal.ai/dashboard" }, { status: 500 });
    }

    const scripts = readScripts();
    const script = scripts.find((s) => s.id === id);
    if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });

    updateScript(id, { videoStatus: "processing", videoJobId: undefined, videoUrl: undefined, avatarId });
    console.log(`[generate-video] "${script.title}" | avatar: ${avatarId}`);

    // ── STEP 1: Generate avatar image via Nano Banana Pro ─────────────────────
    const { generateFilledPrompts } = await import("@/lib/promptgen");
    const { listReferenceImages, readReferenceImage } = await import("@/lib/avatar");
    const filled = await generateFilledPrompts(script);

    // Load avatar reference images for identity-locked generation
    const refFilenames = listReferenceImages(avatarId);
    const referenceImages = refFilenames.slice(0, 4).map((filename) => {
      const buffer = readReferenceImage(avatarId, filename);
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return { buffer, mimeType };
    });
    if (referenceImages.length > 0) {
      console.log(`[generate-video] Using ${referenceImages.length} reference image(s) for identity lock`);
    } else {
      console.warn(`[generate-video] No reference images found for avatar "${avatarId}" — image may not match your avatar`);
    }

    console.log(`[generate-video] Generating image (Nano Banana Pro)...`);
    const avatarImageUrl: string = await generateNanoBananaPro(
      filled.imagePrompt,
      referenceImages.length > 0 ? referenceImages : undefined
    );

    // Save local copy
    try {
      const buf = Buffer.from(await (await fetch(avatarImageUrl)).arrayBuffer());
      saveGeneratedImage(avatarId, id, buf);
    } catch { /* best effort */ }

    // ── STEP 2: Submit Kling 3.0 image-to-video job ───────────────────────────
    console.log(`[generate-video] Submitting Kling 3.0 video job (${duration}s, ${filled.framing}, ${filled.actionType})...`);
    const videoJobId = await submitKling3Video(avatarImageUrl, filled.videoPrompt, duration, filled.negativePrompt);

    updateScript(id, {
      videoJobId,
      videoStatus: "processing",
      videoProvider: "fal",
      videoMode: "kling3",
      avatarId,
      imagePrompt: filled.imagePrompt,
      videoPrompt: filled.videoPrompt,
      generatedImageUrl: avatarImageUrl,
    });

    return NextResponse.json({ success: true, jobId: videoJobId });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[generate-video] ERROR:`, msg);
    try {
      const { updateScript } = await import("@/lib/csv");
      updateScript(id, { videoStatus: "failed" });
    } catch { /* best effort */ }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
