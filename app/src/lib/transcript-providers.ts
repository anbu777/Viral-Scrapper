import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import type { TranscriptProviderName } from "@/lib/types";

const execFileAsync = promisify(execFile);

export async function transcribeWithProvider(input: {
  provider: TranscriptProviderName;
  videoBuffer: Buffer;
  contentType: string;
}) {
  if (input.provider === "gemini") {
    const file = await uploadVideo(input.videoBuffer, input.contentType);
    return analyzeVideo(
      file.uri,
      file.mimeType,
      'Transcribe every single word spoken in this video. Output only raw transcript. If nothing is spoken, write "[No spoken words]".'
    );
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "viral-ig-transcript-"));
  const videoPath = path.join(dir, "input.mp4");
  const audioPath = path.join(dir, "audio.wav");
  try {
    await writeFile(videoPath, input.videoBuffer);
    await execFileAsync(ffmpegPath.path, ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", audioPath]);
    const whisperCommand = process.env.WHISPER_COMMAND || "whisper";
    await execFileAsync(whisperCommand, [audioPath, "--model", "base", "--output_format", "txt", "--output_dir", dir], { timeout: 300_000 });
    const transcriptPath = path.join(dir, "audio.txt");
    return (await readFile(transcriptPath, "utf-8")).trim() || "[No spoken words]";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
