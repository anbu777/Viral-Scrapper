/**
 * Higgsfield.ai API client
 *
 * Docs: https://docs.higgsfield.ai
 * Auth: Authorization: Key {api_key}:{api_secret}
 *
 * Confirmed working endpoints (return 403 "Not enough credits" = exists):
 *   kling-video/v3.0/pro/image-to-video   ← Kling 3.0 (preferred)
 *   kling-video/v2.1/pro/image-to-video
 *   kling-video/v2.1/standard/image-to-video
 *   bytedance/seedance/v1/pro/image-to-video
 *   bytedance/seedance/v1/lite/image-to-video
 *   higgsfield-ai/dop/standard
 *   higgsfield-ai/soul/standard             ← image generation
 *
 * File upload: two-step pre-signed S3
 *   POST /files/generate-upload-url → { public_url, upload_url }
 *   PUT  upload_url  (raw bytes, no auth)
 *
 * Status: GET /requests/{request_id}/status
 *   → { status: "queued"|"in_progress"|"completed"|"failed"|"nsfw"|"canceled",
 *        images: [{url}], video: {url} }
 */

const BASE_URL = "https://platform.higgsfield.ai";

function getAuth(): string {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) throw new Error("HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET not set in .env.local");
  return `Key ${key}:${secret}`;
}

function jsonHeaders() {
  return {
    Authorization: getAuth(),
    "Content-Type": "application/json",
  };
}

// ─── Job status ───────────────────────────────────────────────────────────────

export interface HiggsfieldJobStatus {
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  imageUrl?: string;
  errorMessage?: string;
}

export function parseJobResponse(data: Record<string, unknown>): HiggsfieldJobStatus {
  const rawStatus = String(data.status ?? data.state ?? "").toLowerCase();

  // Higgsfield status enum: queued, in_progress, completed, failed, nsfw, canceled
  const isCompleted = rawStatus === "completed";
  const isFailed = ["failed", "nsfw", "canceled"].includes(rawStatus);

  if (isCompleted) {
    // Response format: { images: [{url}], video: {url} }
    const imagesArr = data.images as Array<{ url: string }> | undefined;
    const videoObj = data.video as { url: string } | undefined;

    const videoUrl =
      videoObj?.url ??
      (data.video_url as string) ??
      ((data.output as Record<string, unknown>)?.video_url as string) ??
      (data.result_url as string) ??
      undefined;

    const imageUrl =
      imagesArr?.[0]?.url ??
      (data.image_url as string) ??
      ((data.output as Record<string, unknown>)?.image_url as string) ??
      undefined;

    return {
      status: "completed",
      videoUrl: videoUrl || undefined,
      imageUrl: imageUrl || undefined,
    };
  }

  if (isFailed) {
    return {
      status: "failed",
      errorMessage:
        (data.error as string) ??
        (data.message as string) ??
        (data.reason as string) ??
        rawStatus,
    };
  }

  // queued / in_progress → still processing
  return { status: "processing" };
}

// ─── File upload (two-step pre-signed S3) ─────────────────────────────────────

export async function uploadFileToHiggsfield(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  console.log(`[higgsfield] Requesting upload URL for ${filename} (${(buffer.length / 1024).toFixed(0)} KB)...`);

  const genRes = await fetch(`${BASE_URL}/files/generate-upload-url`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ content_type: mimeType }),
  });

  if (!genRes.ok) {
    const text = await genRes.text();
    throw new Error(`Higgsfield generate-upload-url ${genRes.status}: ${text}`);
  }

  const { public_url, upload_url } = await genRes.json() as { public_url: string; upload_url: string };

  const putRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: new Uint8Array(buffer),
  });

  if (!putRes.ok) {
    const text = await putRes.text();
    throw new Error(`Higgsfield S3 upload ${putRes.status}: ${text}`);
  }

  console.log(`[higgsfield] Uploaded ${filename} -> ${public_url.slice(0, 80)}`);
  return public_url;
}

// ─── Image generation (Soul) ──────────────────────────────────────────────────

export async function generateAvatarImage(
  prompt: string,
  referenceImageUrls: string[]
): Promise<string> {
  console.log(`[higgsfield] Generating avatar image (${referenceImageUrls.length} refs)...`);

  const body: Record<string, unknown> = {
    prompt,
    aspect_ratio: "9:16",
    resolution: "720p",
  };
  if (referenceImageUrls.length > 0) {
    body.reference_image_urls = referenceImageUrls;
  }

  // Soul Reference: uses reference images for identity-consistent generation
  // Falls back to Soul Character, then Soul Standard
  let res = await fetch(`${BASE_URL}/higgsfield-ai/soul/reference`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });

  if (res.status === 404 || res.status === 422) {
    console.log(`[higgsfield] soul/reference failed, trying soul/character...`);
    res = await fetch(`${BASE_URL}/higgsfield-ai/soul/character`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    });
  }

  if (res.status === 404 || res.status === 422) {
    console.log(`[higgsfield] soul/character failed, trying soul/standard...`);
    res = await fetch(`${BASE_URL}/higgsfield-ai/soul/standard`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Higgsfield image gen ${res.status}: ${text}`);
  }

  const data = await res.json() as Record<string, unknown>;
  console.log(`[higgsfield] Image job created:`, JSON.stringify(data).slice(0, 200));

  const requestId = (data.request_id ?? data.id ?? data.requestId) as string;
  if (!requestId) throw new Error(`Higgsfield image gen: no request_id in response: ${JSON.stringify(data)}`);
  return requestId;
}

// ─── Image-to-Video (Kling 3.0 / Seedance / DoP) ─────────────────────────────

type VideoMode = "kling3" | "kling2" | "seedance" | "dop";

/**
 * Generate a 10-second video from an image using Kling 3.0 (default), Kling 2.1,
 * Seedance, or DoP. The motion prompt describes how the avatar moves/speaks.
 * No audio required — this is pure image-to-video motion generation.
 */
export async function createVideoFromImage(
  imageUrl: string,
  motionPrompt: string,
  mode: VideoMode = "kling3"
): Promise<string> {
  // Endpoints confirmed from Higgsfield dashboard API Reference
  const ENDPOINT_MAP: Record<VideoMode, string> = {
    kling3: "kling-video/v3.0/pro/image-to-video",   // Kling 3.0 Standard (endpoint path says "pro")
    kling2: "kling-video/v2.1/standard/image-to-video", // Kling 2.1 Standard
    seedance: "bytedance/seedance/v1/pro/image-to-video",
    dop: "higgsfield-ai/dop/standard",
  };

  const endpoint = ENDPOINT_MAP[mode];
  const body = {
    image_url: imageUrl,
    prompt: motionPrompt,
    duration: 10,  // seconds (max supported by most models)
  };

  console.log(`[higgsfield] Submitting image-to-video: ${endpoint}`);

  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    // If Kling 3.0 fails (credits or unavailable), auto-fallback to Kling 2.1
    if (mode === "kling3" && (res.status === 403 || res.status === 404)) {
      console.warn(`[higgsfield] Kling 3.0 failed (${res.status}), falling back to Kling 2.1...`);
      return createVideoFromImage(imageUrl, motionPrompt, "kling2");
    }
    throw new Error(`Higgsfield video gen (${endpoint}) ${res.status}: ${text}`);
  }

  const data = await res.json() as Record<string, unknown>;
  console.log(`[higgsfield] Video job created:`, JSON.stringify(data).slice(0, 200));

  const requestId = (data.request_id ?? data.id ?? data.requestId) as string;
  if (!requestId) throw new Error(`Higgsfield video gen: no request_id: ${JSON.stringify(data)}`);
  return requestId;
}

// ─── Motion control (Kling image-to-video with reference video) ───────────────

export async function createMotionControl(
  imageUrl: string,
  referenceVideoUrl: string,
  prompt: string = "Natural realistic motion, photorealistic",
  motionStrength: number = 0.8
): Promise<string> {
  console.log(`[higgsfield] Submitting motion control (strength: ${motionStrength})...`);

  const body = {
    image_url: imageUrl,
    motion_reference_video_url: referenceVideoUrl,
    prompt,
    motion_strength: motionStrength,
    duration: 10,
  };

  const res = await fetch(`${BASE_URL}/kling-video/v2.1/pro/image-to-video`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Higgsfield motion control ${res.status}: ${text}`);
  }

  const data = await res.json() as Record<string, unknown>;
  const requestId = (data.request_id ?? data.id ?? data.requestId) as string;
  if (!requestId) throw new Error(`Higgsfield motion control: no request_id: ${JSON.stringify(data)}`);
  return requestId;
}

// ─── Status polling ───────────────────────────────────────────────────────────

export async function getHiggsfieldJobStatus(requestId: string): Promise<HiggsfieldJobStatus> {
  const res = await fetch(`${BASE_URL}/requests/${requestId}/status`, {
    headers: { Authorization: getAuth() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Higgsfield status ${res.status}: ${text}`);
  }

  const data = await res.json() as Record<string, unknown>;
  console.log(`[higgsfield] Status [${requestId.slice(0, 8)}...]: ${JSON.stringify(data).slice(0, 150)}`);
  return parseJobResponse(data);
}
