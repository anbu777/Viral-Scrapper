/**
 * fal.ai client — Avatar image generation + Kling 3.0 (video)
 *
 * Image generation strategy (identity-consistent):
 *   1 reference image  → fal-ai/flux-pulid     (FLUX + PuLID, single portrait)
 *   2-4 ref images     → fal-ai/photomaker      (ZIP archive, best multi-ref consistency)
 *   0 ref images       → fal-ai/nano-banana-pro (fallback, no identity lock)
 *
 * Video:
 *   fal-ai/kling-video/o3/standard/image-to-video   image → 5-15s video
 *
 * Auth: FAL_KEY env var
 * Docs: https://fal.ai/models
 */

import { fal } from "@fal-ai/client";
import JSZip from "jszip";

const KLING3_MODEL = "fal-ai/kling-video/o3/standard/image-to-video";

function configure() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set in .env.local — get it at fal.ai/dashboard");
  fal.config({ credentials: key });
}

// ─── Image generation: Nano Banana Pro ───────────────────────────────────────

/**
 * Uploads a local image buffer to fal.ai CDN storage.
 * Returns a public URL usable as model input (identity reference, etc.)
 */
export async function uploadBufferToFal(buffer: Buffer, mimeType: string): Promise<string> {
  configure();
  const blob = new Blob([buffer as unknown as BlobPart], { type: mimeType });
  const url = await fal.storage.upload(blob);
  console.log(`[fal] Uploaded to fal storage: ${url.slice(0, 80)}`);
  return url;
}

/**
 * Generate an avatar image using the best available identity-locking model.
 *
 * Routing:
 *   2-4 reference images → fal-ai/photomaker  (ZIP archive, strongest multi-ref consistency)
 *   1 reference image    → fal-ai/flux-pulid  (FLUX PuLID, single portrait 9:16)
 *   0 reference images   → fal-ai/nano-banana-pro (fallback, no identity lock)
 *
 * @param prompt          Motion/scene description
 * @param referenceImages Local image buffers from data/avatars/{id}/reference/
 */
export async function generateNanoBananaPro(
  prompt: string,
  referenceImages?: Array<{ buffer: Buffer; mimeType: string }>
): Promise<string> {
  configure();

  const refs = referenceImages ?? [];

  // ── Route A: 2-4 images → PhotoMaker ──────────────────────────────────────
  if (refs.length >= 2) {
    return generateWithPhotoMaker(prompt, refs);
  }

  // ── Route B: exactly 1 image → Flux PuLID ─────────────────────────────────
  if (refs.length === 1) {
    return generateWithFluxPuLID(prompt, refs[0]);
  }

  // ── Route C: no reference images → Nano Banana Pro (no identity lock) ─────
  console.warn(`[fal] No reference images — falling back to Nano Banana Pro (no identity lock)`);
  return generateWithNanoBananaPro(prompt);
}

/**
 * fal-ai/photomaker — multi-reference portrait generation.
 * Packs all reference images into a ZIP archive (1-4 photos recommended).
 * Outputs ~1024×1024; best multi-image identity consistency available on fal.
 */
async function generateWithPhotoMaker(
  prompt: string,
  refs: Array<{ buffer: Buffer; mimeType: string }>
): Promise<string> {
  console.log(`[fal] PhotoMaker — packing ${refs.length} reference images into ZIP...`);

  const zip = new JSZip();
  refs.forEach((ref, i) => {
    const ext = ref.mimeType === "image/png" ? "png" : ref.mimeType === "image/webp" ? "webp" : "jpg";
    zip.file(`ref_${i + 1}.${ext}`, ref.buffer);
  });
  const zipBuffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
  const zipUrl = await uploadBufferToFal(zipBuffer, "application/zip");
  console.log(`[fal] Reference ZIP uploaded (${zipBuffer.length} bytes)`);

  const result = await fal.subscribe("fal-ai/photomaker", {
    input: {
      prompt: `img ${prompt}`,   // PhotoMaker requires "img" token to bind reference identity
      image_archive_url: zipUrl,
      num_images: 1,
      style_strength: 30,        // 15-50 recommended; lower = stronger identity lock
      guidance_scale: 5,
      num_inference_steps: 50,
    },
    pollInterval: 5000,
  }) as unknown as {
    data?: { images?: Array<{ url: string }> };
    images?: Array<{ url: string }>;
  };

  const url = result.data?.images?.[0]?.url ?? result.images?.[0]?.url;
  if (!url) throw new Error("PhotoMaker: no image URL in response");
  console.log(`[fal] PhotoMaker image generated: ${url.slice(0, 80)}`);
  return url;
}

/**
 * fal-ai/flux-pulid — single reference portrait generation (FLUX + PuLID).
 * Best for a single high-quality photo. Outputs 9:16 portrait (576×1024).
 */
async function generateWithFluxPuLID(
  prompt: string,
  ref: { buffer: Buffer; mimeType: string }
): Promise<string> {
  console.log(`[fal] Flux PuLID — uploading single reference image...`);
  const refUrl = await uploadBufferToFal(ref.buffer, ref.mimeType);

  const result = await fal.subscribe("fal-ai/flux-pulid", {
    input: {
      prompt,
      reference_image_url: refUrl,
      id_weight: 0.9,            // 0–1, higher = stronger identity lock
      image_size: { width: 576, height: 1024 },   // 9:16 portrait
      num_images: 1,
      num_inference_steps: 20,
      guidance_scale: 3.5,
      true_cfg: 1,
    },
    pollInterval: 5000,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as unknown as {
    data?: { images?: Array<{ url: string }> };
    images?: Array<{ url: string }>;
  };

  const url = result.data?.images?.[0]?.url ?? result.images?.[0]?.url;
  if (!url) throw new Error("Flux PuLID: no image URL in response");
  console.log(`[fal] Flux PuLID image generated: ${url.slice(0, 80)}`);
  return url;
}

/**
 * fal-ai/nano-banana-pro — fallback when no reference images are available.
 * No identity lock — avatar appearance varies per generation.
 */
async function generateWithNanoBananaPro(prompt: string): Promise<string> {
  console.log(`[fal] Nano Banana Pro — generating image (no identity lock)...`);

  const result = await fal.subscribe("fal-ai/nano-banana-pro", {
    input: {
      prompt,
      num_images: 1,
      aspect_ratio: "9:16",
      resolution: "1K",
      output_format: "jpeg",
    },
  }) as unknown as { data: { images: Array<{ url: string }> }; images?: Array<{ url: string }> };

  const url = result.data?.images?.[0]?.url ?? result.images?.[0]?.url;
  if (!url) throw new Error(`Nano Banana Pro: no image URL in response`);
  console.log(`[fal] Nano Banana Pro image generated: ${url.slice(0, 80)}`);
  return url;
}

// ─── Video generation: Kling 3.0 ─────────────────────────────────────────────

/**
 * Submit a Kling 3.0 image-to-video job (async queue).
 * Returns the fal request_id for polling.
 *
 * @param imageUrl        - Start frame (PhotoMaker/Flux PuLID output URL)
 * @param prompt          - Motion/scene description
 * @param duration        - Seconds: 5–15 (default 10, capped at 15)
 * @param negativePrompt  - What to avoid (blurriness, static shots, identity drift, etc.)
 */
export async function submitKling3Video(
  imageUrl: string,
  prompt: string,
  duration: number = 10,
  negativePrompt?: string
): Promise<string> {
  configure();
  const clampedDuration = Math.min(15, Math.max(5, duration));
  console.log(`[fal] Kling 3.0 — submitting ${clampedDuration}s video job...`);
  console.log(`[fal] Prompt: ${prompt.slice(0, 120)}...`);

  const { request_id } = await fal.queue.submit(KLING3_MODEL, {
    input: {
      image_url: imageUrl,
      prompt,
      negative_prompt: negativePrompt ??
        "static, frozen, blurry, low quality, deformed body, identity drift, morphed face, extra limbs, slow motion start, fade in, black frames",
      duration: String(clampedDuration),
      cfg_scale: 0.5,       // 0–1: higher = follows prompt more strictly
      generate_audio: false,
    },
  });

  console.log(`[fal] Kling 3.0 job submitted: ${request_id}`);
  return request_id;
}

// ─── Status polling ───────────────────────────────────────────────────────────

export type FalJobStatus =
  | { status: "processing" }
  | { status: "completed"; videoUrl: string }
  | { status: "failed"; error: string };

/**
 * Poll a Kling 3.0 job by request_id.
 */
export async function getKling3Status(requestId: string): Promise<FalJobStatus> {
  configure();

  const statusRes = await fal.queue.status(KLING3_MODEL, {
    requestId,
    logs: false,
  });

  const s = (statusRes as unknown as { status: string }).status;
  console.log(`[fal] Status [${requestId.slice(0, 8)}...]: ${s}`);

  if (s === "COMPLETED") {
    const result = await fal.queue.result(KLING3_MODEL, { requestId }) as unknown as {
      video?: { url: string };
      data?: { video?: { url: string } };
    };
    const videoUrl = result.video?.url ?? result.data?.video?.url;
    if (!videoUrl) return { status: "failed", error: "No video URL in result" };
    return { status: "completed", videoUrl };
  }

  if (s === "FAILED") {
    return { status: "failed", error: "fal job failed" };
  }

  // IN_QUEUE or IN_PROGRESS
  return { status: "processing" };
}

// ─── Lipsync: sync-lipsync ────────────────────────────────────────────────────

/**
 * Apply lipsync to a video using fal-ai/sync-lipsync.
 * The model re-renders the mouth region of the avatar to match the audio track.
 *
 * @param videoUrl  - fal.ai CDN URL of the Kling-generated video
 * @param audioUrl  - fal.ai CDN URL of the audio (TTS or extracted from source video)
 * @returns Public URL of the lipsync-corrected video
 */
export async function applySyncLipsync(videoUrl: string, audioUrl: string): Promise<string> {
  configure();
  console.log(`[fal] Applying sync-lipsync...`);

  const result = await fal.subscribe("fal-ai/sync-lipsync", {
    input: {
      video_url: videoUrl,
      audio_url: audioUrl,
      sync_mode: "cut_off",        // trim/cut output to match audio length
      model: "lipsync-1.9.0-beta", // latest available model
    },
    pollInterval: 5000,
  }) as unknown as {
    data?: { video?: { url: string } };
    video?: { url: string };
  };

  const url = result.data?.video?.url ?? result.video?.url;
  if (!url) throw new Error("sync-lipsync: no video URL in response");
  console.log(`[fal] Lipsync applied: ${url.slice(0, 80)}`);
  return url;
}
