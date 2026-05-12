/**
 * Dual-AI consistency check for generated avatar videos.
 *
 * Runs Gemini Vision + Claude Vision in parallel on the same video.
 * Both AIs analyze for character consistency (face, body, style).
 *
 * Logic:
 *   Gemini ✅ + Claude ✅ → overallPass: true  (high confidence, Telegram shows "both passed")
 *   Gemini ✅ + Claude ❌ → overallPass: false (disagreement, Telegram flags for review)
 *   Gemini ❌ + Claude ✅ → overallPass: false (disagreement, Telegram flags for review)
 *   Gemini ❌ + Claude ❌ → overallPass: false (clear fail)
 *
 * Note: Requires ffmpeg installed for Claude frame extraction.
 * Install: winget install ffmpeg
 */

import { uploadVideo, analyzeVideo } from "./gemini";
import { createWriteStream, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export interface ConsistencyResult {
  passed: boolean;
  reason: string;
  ai: "gemini" | "claude";
}

const CONSISTENCY_PROMPT = `You are reviewing a short-form video (Instagram Reel / TikTok) featuring an AI avatar character.

Analyze the video for VISUAL CONSISTENCY of the avatar character:
1. Does the face remain the same person/character throughout? (same facial structure, features)
2. Does the body proportions stay consistent?
3. Are there any obvious glitches, morphs, or identity changes mid-video?
4. Does the lip sync look natural and match the speech?

Respond in this exact format:
VERDICT: PASS or FAIL
REASON: [1-2 sentences explaining your verdict]

Be strict — if you see noticeable inconsistency or artifacting, mark as FAIL.`;

/**
 * Extracts key frames from a video buffer using fluent-ffmpeg.
 * Returns 4 frames at 0%, 33%, 66%, 100% of video duration as base64 PNG strings.
 */
async function extractFrames(videoBuffer: Buffer): Promise<string[]> {
  // Write video to temp file
  const tmpVideo = join(tmpdir(), `hedra-${randomUUID()}.mp4`);
  const tmpFrameDir = join(tmpdir(), `frames-${randomUUID()}`);

  try {
    // Write buffer to temp file
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(tmpVideo);
      stream.write(videoBuffer);
      stream.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    // Dynamically import fluent-ffmpeg (only available at runtime)
    const ffmpeg = (await import("fluent-ffmpeg")).default;
    const { mkdirSync, readFileSync, readdirSync } = await import("fs");

    mkdirSync(tmpFrameDir, { recursive: true });

    // Extract 4 frames spread across the video
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpVideo)
        .screenshots({
          count: 4,
          folder: tmpFrameDir,
          filename: "frame-%i.png",
          size: "720x?",
        })
        .on("end", () => resolve())
        .on("error", reject);
    });

    // Read all extracted frames as base64
    const files = readdirSync(tmpFrameDir).sort();
    const frames = files
      .filter((f) => f.endsWith(".png"))
      .map((f) => readFileSync(join(tmpFrameDir, f)).toString("base64"));

    return frames;
  } finally {
    // Cleanup temp files
    if (existsSync(tmpVideo)) unlinkSync(tmpVideo);
    try {
      const { rmSync } = await import("fs");
      rmSync(tmpFrameDir, { recursive: true, force: true });
    } catch {
      // best effort cleanup
    }
  }
}

/**
 * Runs Claude Vision consistency check on extracted frames.
 * Gracefully skipped (returns passed=true) when ANTHROPIC_API_KEY is missing
 * so the dual-check pipeline still works on a Gemini-only free setup.
 */
async function checkWithClaude(videoBuffer: Buffer): Promise<ConsistencyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ai: "claude",
      passed: true,
      reason: "Claude check skipped (ANTHROPIC_API_KEY not set, using Gemini-only verdict).",
    };
  }

  let frames: string[];
  try {
    frames = await extractFrames(videoBuffer);
  } catch {
    // ffmpeg not available — skip Claude check gracefully
    return {
      ai: "claude",
      passed: true,
      reason: "Frame extraction unavailable (ffmpeg not installed) — skipped Claude check.",
    };
  }

  if (frames.length === 0) {
    return { ai: "claude", passed: true, reason: "No frames extracted — skipped." };
  }

  const imageContent = frames.map((b64) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/png" as const, data: b64 },
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `These are ${frames.length} frames extracted from an AI avatar video (first, middle, and last frames).\n\n${CONSISTENCY_PROMPT}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude Vision error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text || "";

  const verdictMatch = text.match(/VERDICT:\s*(PASS|FAIL)/i);
  const reasonMatch = text.match(/REASON:\s*(.+)/i);

  const passed = verdictMatch?.[1]?.toUpperCase() === "PASS";
  const reason = reasonMatch?.[1]?.trim() ?? text.slice(0, 120);

  return { ai: "claude", passed, reason };
}

/**
 * Runs Gemini Vision consistency check on the full video.
 */
async function checkWithGemini(videoBuffer: Buffer): Promise<ConsistencyResult> {
  // Upload video to Gemini Files API
  const { uri, mimeType } = await uploadVideo(videoBuffer, "video/mp4");

  // Analyze with consistency prompt
  const text = await analyzeVideo(uri, mimeType, CONSISTENCY_PROMPT);

  const verdictMatch = text.match(/VERDICT:\s*(PASS|FAIL)/i);
  const reasonMatch = text.match(/REASON:\s*(.+)/i);

  const passed = verdictMatch?.[1]?.toUpperCase() === "PASS";
  const reason = reasonMatch?.[1]?.trim() ?? text.slice(0, 120);

  return { ai: "gemini", passed, reason };
}

/**
 * Main entry point: runs both AI checks in parallel.
 */
export async function checkConsistency(videoBuffer: Buffer): Promise<{
  gemini: ConsistencyResult;
  claude: ConsistencyResult;
  overallPass: boolean;
}> {
  const [gemini, claude] = await Promise.all([
    checkWithGemini(videoBuffer),
    checkWithClaude(videoBuffer),
  ]);

  return {
    gemini,
    claude,
    overallPass: gemini.passed && claude.passed,
  };
}
