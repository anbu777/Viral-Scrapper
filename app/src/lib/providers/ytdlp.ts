/**
 * Thin wrapper around the `yt-dlp` CLI tool.
 *
 * yt-dlp is free and open source (https://github.com/yt-dlp/yt-dlp) and can
 * download + extract metadata for almost every social platform. We use it
 * as a shared backend for the TikTok and YouTube Shorts providers.
 *
 * Install on Windows:    winget install yt-dlp
 * Install on macOS:      brew install yt-dlp
 * Install on Linux:      pipx install yt-dlp
 */

import { execFile } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Returns common install locations to search when yt-dlp isn't on PATH yet.
 * This helps Windows users who just ran `winget install yt-dlp` without
 * restarting the dev server (PATH refresh requires a new shell).
 */
function winFallbackPaths(): string[] {
  if (process.platform !== "win32") return [];
  const local = process.env.LOCALAPPDATA;
  const programFiles = process.env["ProgramFiles"];
  const candidates: string[] = [];
  if (local) {
    candidates.push(
      path.join(
        local,
        "Microsoft",
        "WinGet",
        "Packages",
        "yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe",
        "yt-dlp.exe"
      ),
      path.join(local, "Microsoft", "WinGet", "Links", "yt-dlp.exe"),
      path.join(local, "Programs", "yt-dlp", "yt-dlp.exe")
    );
  }
  if (programFiles) {
    candidates.push(path.join(programFiles, "yt-dlp", "yt-dlp.exe"));
  }
  return candidates;
}

let cachedCommand: string | null = null;

function getYtdlpCommand(): string {
  const fromEnv = process.env.YTDLP_COMMAND?.trim();
  if (fromEnv) return fromEnv;
  if (cachedCommand) return cachedCommand;
  for (const candidate of winFallbackPaths()) {
    if (existsSync(candidate)) {
      cachedCommand = candidate;
      return candidate;
    }
  }
  return "yt-dlp";
}

export interface YtdlpMetadata {
  /** Raw provider id (e.g. video id). */
  id: string;
  /** Canonical webpage URL. */
  url: string;
  /** Uploader / channel handle, without leading "@". */
  uploader: string;
  uploaderId?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  /** Direct media URL (often expires; refresh on demand). */
  videoUrl?: string;
  /** ISO-8601 upload time if available. */
  uploadDate?: string;
  durationSeconds?: number;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  /** Whole JSON payload returned by yt-dlp. */
  raw: Record<string, unknown>;
}

function parseUploadDate(raw: Record<string, unknown>): string {
  const ts = raw.timestamp;
  if (typeof ts === "number" && ts > 0) {
    return new Date(ts * 1000).toISOString();
  }
  const d = raw.upload_date;
  if (typeof d === "string" && /^\d{8}$/.test(d)) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`;
  }
  return "";
}

/**
 * Fetches JSON metadata for a single video URL.
 * Uses `--dump-single-json --no-warnings --skip-download`.
 * Throws if yt-dlp is missing or the URL is private/blocked.
 */
export async function getVideoMetadata(url: string): Promise<YtdlpMetadata> {
  const cmd = getYtdlpCommand();
  let stdout: string;
  try {
    const result = await execFileAsync(cmd, [
      "--dump-single-json",
      "--no-warnings",
      "--skip-download",
      url,
    ], { maxBuffer: 50 * 1024 * 1024, timeout: 60_000 });
    stdout = result.stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`yt-dlp metadata failed for ${url}: ${message}`);
  }
  const data = JSON.parse(stdout) as Record<string, unknown>;
  return {
    id: String(data.id ?? ""),
    url: String(data.webpage_url ?? url),
    uploader: String(data.uploader_id ?? data.uploader ?? data.channel ?? "").replace(/^@/, ""),
    uploaderId: data.uploader_id ? String(data.uploader_id) : undefined,
    title: typeof data.title === "string" ? data.title : undefined,
    description: typeof data.description === "string" ? data.description : undefined,
    thumbnail: typeof data.thumbnail === "string" ? data.thumbnail : undefined,
    videoUrl: typeof data.url === "string" ? data.url : undefined,
    uploadDate: parseUploadDate(data),
    durationSeconds: typeof data.duration === "number" ? data.duration : undefined,
    viewCount: typeof data.view_count === "number" ? data.view_count : 0,
    likeCount: typeof data.like_count === "number" ? data.like_count : 0,
    commentCount: typeof data.comment_count === "number" ? data.comment_count : 0,
    raw: data,
  };
}

/**
 * Lists the latest videos for a given channel/profile URL.
 * Uses `--flat-playlist` for a fast initial pass (no per-video metadata),
 * then optionally hydrates each item with `getVideoMetadata` if `hydrate=true`.
 *
 * `playlistEnd` caps how many items we pull from the listing.
 */
export async function listChannelVideos(
  channelUrl: string,
  playlistEnd: number,
  hydrate = true
): Promise<YtdlpMetadata[]> {
  const cmd = getYtdlpCommand();
  const args = [
    "--flat-playlist",
    "--dump-single-json",
    "--no-warnings",
    "--playlist-end", String(Math.max(1, playlistEnd)),
    channelUrl,
  ];
  let stdout: string;
  try {
    const result = await execFileAsync(cmd, args, { maxBuffer: 100 * 1024 * 1024, timeout: 120_000 });
    stdout = result.stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`yt-dlp listing failed for ${channelUrl}: ${message}`);
  }
  const payload = JSON.parse(stdout) as Record<string, unknown>;
  const entries = Array.isArray(payload.entries) ? (payload.entries as Array<Record<string, unknown>>) : [];

  if (!hydrate) {
    return entries.map((entry) => ({
      id: String(entry.id ?? ""),
      url: String(entry.url ?? entry.webpage_url ?? ""),
      uploader: String(entry.uploader_id ?? entry.uploader ?? "").replace(/^@/, ""),
      title: typeof entry.title === "string" ? entry.title : undefined,
      thumbnail: typeof entry.thumbnail === "string" ? entry.thumbnail : undefined,
      uploadDate: parseUploadDate(entry),
      durationSeconds: typeof entry.duration === "number" ? entry.duration : undefined,
      viewCount: typeof entry.view_count === "number" ? entry.view_count : 0,
      likeCount: typeof entry.like_count === "number" ? entry.like_count : 0,
      commentCount: typeof entry.comment_count === "number" ? entry.comment_count : 0,
      raw: entry,
    }));
  }

  const detailed: YtdlpMetadata[] = [];
  for (const entry of entries) {
    const url = typeof entry.url === "string" && entry.url.startsWith("http")
      ? entry.url
      : typeof entry.webpage_url === "string" ? entry.webpage_url : null;
    if (!url) continue;
    try {
      detailed.push(await getVideoMetadata(url));
    } catch {
      /* skip individual failures */
    }
  }
  return detailed;
}

/**
 * Downloads a single video to a Buffer using yt-dlp.
 * Returns the MP4 bytes plus a guessed content-type.
 */
export async function downloadVideoToBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const cmd = getYtdlpCommand();
  const dir = await mkdtemp(path.join(os.tmpdir(), "ytdlp-"));
  const outPath = path.join(dir, "video.mp4");
  try {
    await execFileAsync(cmd, [
      "-f", "mp4/bestvideo*+bestaudio/best",
      "--no-warnings",
      "--no-playlist",
      "-o", outPath,
      url,
    ], { maxBuffer: 200 * 1024 * 1024, timeout: 5 * 60_000 });
    if (!existsSync(outPath)) throw new Error(`yt-dlp did not produce ${outPath}`);
    const buffer = await readFile(outPath);
    return { buffer, contentType: "video/mp4" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Returns true if yt-dlp is callable on the host. */
export async function isYtdlpAvailable(): Promise<boolean> {
  try {
    await execFileAsync(getYtdlpCommand(), ["--version"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}
