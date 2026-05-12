/**
 * Local thumbnail caching utility.
 *
 * Instagram / TikTok / YouTube CDN thumbnail URLs expire (Instagram is the
 * worst — links often die within hours). To keep the videos dashboard usable
 * over time, we mirror every scraped/imported thumbnail to
 * `app/public/thumbnails/<id>.<ext>` so they survive forever.
 *
 * The helper is fire-and-forget friendly: any failure (network, timeout, bad
 * content type, oversized image) is swallowed and the original remote URL is
 * returned instead so the UI still has a chance to render something.
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const THUMBNAIL_DIR = path.join(process.cwd(), "public", "thumbnails");
const PUBLIC_PREFIX = "/thumbnails";
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB cap per image
const DOWNLOAD_TIMEOUT_MS = 8000;

function ensureDir(): void {
  if (!existsSync(THUMBNAIL_DIR)) {
    mkdirSync(THUMBNAIL_DIR, { recursive: true });
  }
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return "jpg";
  const lower = contentType.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  return "jpg";
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Download a remote thumbnail and persist it under `public/thumbnails/<id>.<ext>`.
 *
 * @returns A path like `/thumbnails/abc.jpg` that the browser can load
 *          directly, or the original URL if caching is impossible. Empty
 *          string when the URL itself is empty.
 */
export async function cacheThumbnail(
  remoteUrl: string | undefined | null,
  id: string
): Promise<string> {
  if (!remoteUrl) return "";
  if (!isHttpUrl(remoteUrl)) return remoteUrl;

  // Already a local thumbnail — leave it alone.
  if (remoteUrl.startsWith(PUBLIC_PREFIX) || remoteUrl.startsWith("/")) {
    return remoteUrl;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(remoteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) return remoteUrl;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) return remoteUrl;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return remoteUrl;

    ensureDir();
    const ext = extensionFromContentType(contentType);
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeId}.${ext}`;
    writeFileSync(path.join(THUMBNAIL_DIR, filename), buffer);

    return `${PUBLIC_PREFIX}/${filename}`;
  } catch {
    return remoteUrl;
  } finally {
    clearTimeout(timeout);
  }
}
