import { NextRequest, NextResponse } from "next/server";
import { readScripts, updateScript } from "@/lib/csv";
import { getKling3Status } from "@/lib/fal";
import { sendVideoForApproval } from "@/lib/telegram";

// Module-level lock: prevents concurrent polls triggering duplicate sends within the same process
const completingIds = new Set<string>();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const scripts = readScripts();
    const script = scripts.find((s) => s.id === id);
    if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });

    // Terminal state — return cached result immediately
    if (["awaiting_approval", "approved", "rejected", "failed"].includes(script.videoStatus ?? "")) {
      return NextResponse.json({
        status: script.videoStatus,
        videoUrl: script.videoUrl,
      });
    }

    if (!script.videoJobId || script.videoStatus !== "processing") {
      return NextResponse.json({ status: script.videoStatus ?? "idle" });
    }

    // Poll fal.ai Kling 3.0
    const jobStatus = await getKling3Status(script.videoJobId);

    if (jobStatus.status === "failed") {
      updateScript(id, { videoStatus: "failed" });
      return NextResponse.json({ status: "failed", error: jobStatus.error });
    }

    if (jobStatus.status === "processing") {
      return NextResponse.json({ status: "processing" });
    }

    // ── Kling job completed — run completion pipeline exactly once ─────────────

    const { videoUrl: klingVideoUrl } = jobStatus;

    // PRIMARY guard: re-read script fresh from CSV
    // Catches server restarts/hot-reloads that reset the in-memory Set, and multi-process races
    const freshScript = readScripts().find((s) => s.id === id);
    if (!freshScript || freshScript.videoStatus !== "processing") {
      console.log(`[video-status] ${id} already handled (${freshScript?.videoStatus}) — skipping`);
      return NextResponse.json({
        status: freshScript?.videoStatus ?? "awaiting_approval",
        videoUrl: freshScript?.videoUrl,
      });
    }

    // SECONDARY guard: in-memory lock for concurrent requests in same process
    if (completingIds.has(id)) {
      console.log(`[video-status] Completion in progress for ${id} — skipping duplicate`);
      return NextResponse.json({ status: "processing" });
    }
    completingIds.add(id);

    // Immediately claim — any subsequent poll hits the terminal-state check at the top
    updateScript(id, { videoStatus: "awaiting_approval", videoUrl: klingVideoUrl });

    try {
      // ── Step 1: Download the raw Kling video ───────────────────────────────
      let rawVideoBuffer: Buffer | null = null;
      try {
        const resp = await fetch(klingVideoUrl);
        if (resp.ok) rawVideoBuffer = Buffer.from(await resp.arrayBuffer());
        console.log(`[video-status] Kling video downloaded (${rawVideoBuffer?.length ?? 0} bytes)`);
      } catch (e) {
        console.warn(`[video-status] Kling video download failed:`, e);
      }

      // ── Step 2: Get audio ─────────────────────────────────────────────────
      // Clone mode → extract original video's audio (same song/voiceover as source)
      // Script mode → generate TTS from spoken script text
      let audioBuffer: Buffer | null = null;

      const isClone = script.contentType === "Video Clone";

      if (isClone && script.sourceVideoUrl) {
        // Clone: download source video and extract its audio track
        try {
          console.log(`[video-status] Clone mode — downloading source video for audio extraction...`);
          const srcResp = await fetch(script.sourceVideoUrl);
          if (srcResp.ok) {
            const srcBuffer = Buffer.from(await srcResp.arrayBuffer());
            const { extractAudioFromVideo } = await import("@/lib/tts");
            audioBuffer = extractAudioFromVideo(srcBuffer);
            console.log(`[video-status] Source audio extracted (${audioBuffer.length} bytes)`);
          }
        } catch (e) {
          console.warn(`[video-status] Source audio extraction failed — will try TTS fallback:`, e);
        }
      }

      // TTS fallback: used for scripts, or clones where source audio extraction failed
      if (!audioBuffer && process.env.ELEVENLABS_API_KEY) {
        try {
          const { extractSpokenText } = await import("@/lib/scriptutils");
          const { generateAudioMp3 } = await import("@/lib/tts");
          const { readAvatar } = await import("@/lib/avatar");

          const spokenText = extractSpokenText(script.script ?? "");
          if (spokenText) {
            const avatarProfile = script.avatarId ? readAvatar(script.avatarId) : null;
            const voiceId = avatarProfile?.voiceId || undefined;
            console.log(`[video-status] Generating TTS audio (${spokenText.length} chars)...`);
            audioBuffer = await generateAudioMp3(spokenText, voiceId);
            console.log(`[video-status] TTS audio ready (${audioBuffer.length} bytes)`);
          }
        } catch (e) {
          console.warn(`[video-status] TTS generation failed:`, e);
        }
      }

      // ── Step 3: Apply lipsync (mouth matches audio) ───────────────────────
      // Upload audio to fal storage → sync-lipsync rewrites the mouth region
      let finalVideoBuffer: Buffer | null = rawVideoBuffer;
      let finalVideoUrl = klingVideoUrl;

      if (audioBuffer && rawVideoBuffer) {
        try {
          const { uploadBufferToFal, applySyncLipsync } = await import("@/lib/fal");

          // Upload audio to fal CDN so sync-lipsync can fetch it
          console.log(`[video-status] Uploading audio to fal storage...`);
          const audioUrl = await uploadBufferToFal(audioBuffer, "audio/mpeg");

          // Apply lipsync — mouth movements now sync to the audio
          console.log(`[video-status] Applying sync-lipsync...`);
          finalVideoUrl = await applySyncLipsync(klingVideoUrl, audioUrl);

          // Download the lipsync result
          const lsResp = await fetch(finalVideoUrl);
          if (lsResp.ok) {
            finalVideoBuffer = Buffer.from(await lsResp.arrayBuffer());
            console.log(`[video-status] Lipsync video ready (${finalVideoBuffer.length} bytes)`);
          }
        } catch (e) {
          console.warn(`[video-status] Lipsync failed — falling back to simple audio mux:`, e);
          // Fallback: just mux audio without lipsync (mouth won't match but at least has audio)
          try {
            const { mergeAudioIntoVideo } = await import("@/lib/tts");
            finalVideoBuffer = mergeAudioIntoVideo(rawVideoBuffer, audioBuffer);
            console.log(`[video-status] Audio muxed as fallback (${finalVideoBuffer.length} bytes)`);
          } catch (e2) {
            console.warn(`[video-status] Audio mux fallback also failed:`, e2);
          }
        }
      }

      // ── Step 4: Send to Telegram for your approval ────────────────────────
      await sendVideoForApproval({
        videoUrl: finalVideoUrl,
        videoBuffer: finalVideoBuffer ?? undefined,
        scriptTitle: script.title,
        scriptId: id,
        videoCreator: script.videoCreator,
        videoViews: script.videoViews,
      });

      console.log(`[video-status] Sent to Telegram for approval: ${id}`);
    } finally {
      completingIds.delete(id);
    }

    return NextResponse.json({ status: "awaiting_approval", videoUrl: klingVideoUrl });

  } catch (err) {
    console.error("[video-status]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
