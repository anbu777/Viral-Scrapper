/**
 * Free TTS provider using Microsoft Edge's public TTS endpoint via `msedge-tts`.
 *
 * Why this exists:
 *   ElevenLabs only gives ~10k characters/month free, which is exhausted after
 *   2-3 scripts. Edge TTS uses the same engine that powers the "Read aloud"
 *   feature in Microsoft Edge browser. No API key, no quota, no signup.
 *
 * Tradeoffs vs ElevenLabs:
 *   - Edge TTS supports 400+ neural voices in 140+ languages (very good quality).
 *   - It cannot clone a specific voice — only preset neural voices.
 *   - If you need a cloned voice, use ElevenLabs (paid).
 *
 * Default voice: en-US-AriaNeural (clear, friendly, conversational female).
 * Override via TTS_FREE_VOICE env var (e.g. "en-US-GuyNeural", "id-ID-GadisNeural").
 *
 * Voice list: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support#tts
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const DEFAULT_VOICE = "en-US-AriaNeural";

function getFreeVoice(): string {
  return process.env.TTS_FREE_VOICE?.trim() || DEFAULT_VOICE;
}

/**
 * Generates an MP3 audio buffer from text using Microsoft Edge's free TTS.
 * Voice can be overridden via the `voiceName` argument or the
 * `TTS_FREE_VOICE` environment variable.
 *
 * No API key required.
 */
export async function generateFreeTtsMp3(text: string, voiceName?: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  const voice = voiceName?.trim() || getFreeVoice();

  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(text);

  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    audioStream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    audioStream.on("end", () => {
      try {
        tts.close();
      } catch {
        /* ignore */
      }
      if (chunks.length === 0) {
        reject(new Error("Edge TTS returned no audio data."));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    audioStream.on("close", () => {
      if (chunks.length > 0) resolve(Buffer.concat(chunks));
    });
    audioStream.on("error", (error) => {
      try {
        tts.close();
      } catch {
        /* ignore */
      }
      reject(error);
    });
  });
}

/** Returns true when no paid TTS keys are set and we should default to Edge TTS. */
export function shouldUseFreeTts(): boolean {
  return !process.env.ELEVENLABS_API_KEY;
}
