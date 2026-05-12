/**
 * TTS client.
 *
 * Free-by-default architecture:
 *   - If `ELEVENLABS_API_KEY` is set, uses ElevenLabs (premium, voice cloning).
 *   - Otherwise, automatically falls back to Microsoft Edge TTS (free, no key).
 *
 * ElevenLabs setup (optional, premium):
 *   1. Sign up at elevenlabs.io
 *   2. Go to Voices → Add Voice → clone your avatar's voice (or pick a preset)
 *   3. Copy the Voice ID from the voice settings page
 *   4. Add ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID to .env
 *
 * Free fallback (Microsoft Edge TTS, default):
 *   - 400+ neural voices in 140+ languages, no signup, no rate limits in normal use.
 *   - Override the voice via `TTS_FREE_VOICE` env var.
 *   - See `tts-free.ts` for details.
 */

import { spawnSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { generateFreeTtsMp3, shouldUseFreeTts } from "./tts-free";

function hasElevenLabs(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not set");
  return key;
}

function getVoiceId(): string {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID not set — set it to your cloned voice ID from elevenlabs.io/app/voice-lab");
  return voiceId;
}

/**
 * Converts an MP3 buffer to WAV using ffmpeg (required by Higgsfield which only accepts audio/x-wav).
 * ffmpeg reads from stdin and writes WAV to stdout — no temp files needed.
 */
function mp3ToWav(mp3: Buffer): Buffer {
  const result = spawnSync(
    ffmpegPath.path,
    ["-i", "pipe:0", "-f", "wav", "-ar", "44100", "-ac", "1", "pipe:1"],
    { input: mp3, maxBuffer: 50 * 1024 * 1024 }
  );
  if (result.error) throw new Error(`ffmpeg error: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`ffmpeg conversion failed: ${result.stderr?.toString()}`);
  return result.stdout as Buffer;
}

/**
 * Generates WAV audio from text using TTS.
 * Uses ElevenLabs if configured, otherwise falls back to free Edge TTS.
 * Output is always WAV (some downstream services require this format).
 */
export async function generateAudio(text: string): Promise<Buffer> {
  if (shouldUseFreeTts()) {
    const mp3 = await generateFreeTtsMp3(text);
    return mp3ToWav(mp3);
  }

  const apiKey = getApiKey();
  const voiceId = getVoiceId();

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",   // best quality, supports all languages
        voice_settings: {
          stability: 0.5,          // 0–1, higher = more consistent but less expressive
          similarity_boost: 0.75,  // 0–1, higher = closer to original cloned voice
          style: 0.3,              // 0–1, adds style variation
          use_speaker_boost: true, // enhances clarity
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs TTS error ${response.status}: ${err}`);
  }

  const mp3 = Buffer.from(await response.arrayBuffer());
  return mp3ToWav(mp3);
}

/**
 * Generates MP3 audio from text using TTS.
 * Uses ElevenLabs if configured (with optional per-avatar voiceId override),
 * otherwise falls back to free Edge TTS. The voiceId argument is treated as
 * the Edge voice name in fallback mode (e.g. "en-US-AriaNeural").
 *
 * Returns the raw MP3 buffer.
 */
export async function generateAudioMp3(text: string, voiceId?: string): Promise<Buffer> {
  if (!hasElevenLabs()) {
    return generateFreeTtsMp3(text, voiceId);
  }

  const apiKey = getApiKey();
  const resolvedVoiceId = voiceId ?? getVoiceId();

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs TTS error ${response.status}: ${err}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Extracts the audio track from a video buffer as MP3 using ffmpeg.
 * Used in clone mode to pull the original song/voiceover for lipsync.
 */
export function extractAudioFromVideo(videoBuffer: Buffer): Buffer {
  const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const videoPath = path.join(tmpdir(), `src_${ts}.mp4`);
  const audioPath = path.join(tmpdir(), `aud_${ts}.mp3`);

  try {
    writeFileSync(videoPath, videoBuffer);

    const result = spawnSync(
      ffmpegPath.path,
      [
        "-i", videoPath,
        "-vn",                   // no video stream
        "-acodec", "libmp3lame",
        "-q:a", "2",             // high quality VBR
        "-y", audioPath,
      ],
      { maxBuffer: 50 * 1024 * 1024 }
    );

    if (result.error) throw new Error(`ffmpeg error: ${result.error.message}`);
    if (result.status !== 0) {
      throw new Error(`ffmpeg audio extraction failed: ${result.stderr?.toString().slice(-300)}`);
    }

    const audioBuffer = readFileSync(audioPath);
    console.log(`[tts] Extracted audio from video: ${audioBuffer.length} bytes`);
    return audioBuffer;
  } finally {
    for (const p of [videoPath, audioPath]) {
      try { unlinkSync(p); } catch { /* best effort */ }
    }
  }
}

/**
 * Merges an MP3 audio buffer into an MP4 video buffer using ffmpeg.
 * Audio is re-encoded to AAC; video stream is copied as-is.
 * The shorter of the two streams determines output duration (-shortest).
 * Returns the merged MP4 buffer.
 */
export function mergeAudioIntoVideo(videoBuffer: Buffer, audioMp3Buffer: Buffer): Buffer {
  const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const videoPath = path.join(tmpdir(), `vid_${ts}.mp4`);
  const audioPath = path.join(tmpdir(), `aud_${ts}.mp3`);
  const outPath   = path.join(tmpdir(), `out_${ts}.mp4`);

  try {
    writeFileSync(videoPath, videoBuffer);
    writeFileSync(audioPath, audioMp3Buffer);

    const result = spawnSync(
      ffmpegPath.path,
      [
        "-i", videoPath,
        "-i", audioPath,
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        "-y", outPath,
      ],
      { maxBuffer: 200 * 1024 * 1024 }
    );

    if (result.error) throw new Error(`ffmpeg error: ${result.error.message}`);
    if (result.status !== 0) {
      throw new Error(`ffmpeg mux failed: ${result.stderr?.toString().slice(-500)}`);
    }

    return readFileSync(outPath);
  } finally {
    for (const p of [videoPath, audioPath, outPath]) {
      try { unlinkSync(p); } catch { /* best effort */ }
    }
  }
}
