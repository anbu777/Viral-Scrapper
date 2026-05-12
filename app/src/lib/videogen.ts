/**
 * D-ID API client for AI avatar video generation.
 * Takes a public avatar image URL + audio file and produces a lip-synced talking avatar video.
 *
 * Docs: https://docs.d-id.com/reference/createtalk
 * Pricing: ~$0.33–0.50 per 60-sec video. Free trial available — no credit card needed.
 *
 * Setup:
 * 1. Sign up at d-id.com (free trial, no credit card)
 * 2. Go to Studio → API → copy your API key
 * 3. Add DID_API_KEY to .env
 * 4. Host your avatar image publicly (Imgur, Cloudinary, etc.) → add AVATAR_PUBLIC_URL to .env
 */

const DID_BASE_URL = "https://api.d-id.com";

function getApiKey(): string {
  const key = process.env.DID_API_KEY;
  if (!key) throw new Error("DID_API_KEY not set — get it at d-id.com/studio");
  return key;
}

// D-ID API key format: "base64(email):secret"
// Use directly in Basic auth header as D-ID provides it
function didAuth() {
  return `Basic ${getApiKey()}`;
}

function didHeaders(contentType = "application/json") {
  return {
    Authorization: didAuth(),
    "Content-Type": contentType,
  };
}

/**
 * Uploads an image buffer to D-ID's image storage.
 * Use this instead of external hosting (Imgur etc.) — D-ID only trusts its own CDN.
 * @returns D-ID hosted image URL
 */
export async function uploadDIDImage(imageBuffer: Buffer, mimeType = "image/jpeg"): Promise<string> {
  const ext = mimeType.split("/")[1] ?? "jpg";
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  formData.append("image", blob, `avatar.${ext}`);

  const response = await fetch(`${DID_BASE_URL}/images`, {
    method: "POST",
    headers: { Authorization: didAuth() },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D-ID image upload error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.url as string;
}

/**
 * Uploads an MP3 audio buffer to D-ID's storage.
 * D-ID needs a publicly accessible URL for the audio — this handles it.
 * @returns Public audio URL hosted by D-ID
 */
export async function uploadDIDAudio(audioBuffer: Buffer): Promise<string> {
  const apiKey = getApiKey();

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" });
  formData.append("audio", blob, "audio.mp3");

  const response = await fetch(`${DID_BASE_URL}/audios`, {
    method: "POST",
    headers: {
      Authorization: didAuth(),
      // NOTE: Do NOT set Content-Type for multipart — fetch sets it automatically with boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D-ID audio upload error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.url as string;
}

/**
 * Creates a D-ID talking avatar video job.
 * @param avatarImageUrl - Publicly accessible URL of the avatar image
 * @param audioUrl - D-ID hosted audio URL (from uploadDIDAudio)
 * @returns Talk ID for polling
 */
export async function createDIDTalk(
  avatarImageUrl: string,
  audioUrl: string
): Promise<string> {
  const response = await fetch(`${DID_BASE_URL}/talks`, {
    method: "POST",
    headers: didHeaders(),
    body: JSON.stringify({
      source_url: avatarImageUrl,
      script: {
        type: "audio",
        audio_url: audioUrl,
      },
      config: {
        fluent: true,
        pad_audio: 0.0,
        stitch: true, // blends avatar edges naturally
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D-ID talk creation error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.id as string;
}

export interface VideoJobStatus {
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  errorMessage?: string;
}

/**
 * Polls the status of a D-ID talk job.
 */
export async function getVideoJobStatus(talkId: string): Promise<VideoJobStatus> {
  const response = await fetch(`${DID_BASE_URL}/talks/${talkId}`, {
    headers: { Authorization: didAuth() },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D-ID status check error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const status = (data.status as string).toLowerCase();

  if (status === "done") {
    return { status: "completed", videoUrl: data.result_url as string };
  }
  if (status === "error" || status === "rejected") {
    return { status: "failed", errorMessage: data.error?.description ?? "Unknown error" };
  }
  // "created" | "started" | "processing"
  return { status: "processing" };
}
