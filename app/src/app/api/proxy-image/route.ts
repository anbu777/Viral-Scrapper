import { NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "cdninstagram.com",
  "fbcdn.net",
  "fna.fbcdn.net",
  "fal.media",
  "fal.ai",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "byteoversea.com",
  "muscdn.com",
  "ytimg.com",
  "ggpht.com",
];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function isPrivateHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function isAllowedUrl(raw: string) {
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") return false;
  if (isPrivateHostname(parsed.hostname)) return false;
  return ALLOWED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
}

/** Instagram / Facebook CDNs often return 403 without a same-site Referer. */
function instagramFetchHeaders(targetUrl: string): Record<string, string> {
  const parsed = new URL(targetUrl);
  const host = parsed.hostname;
  const isMetaCdn =
    host.includes("cdninstagram.com") ||
    host.includes("fbcdn.net") ||
    host.endsWith(".cdninstagram.com");
  const base: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (isMetaCdn) {
    base.Referer = "https://www.instagram.com/";
    base.Origin = "https://www.instagram.com";
    base["Sec-Fetch-Site"] = "cross-site";
    base["Sec-Fetch-Mode"] = "no-cors";
    base["Sec-Fetch-Dest"] = "image";
  }
  return base;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    if (!isAllowedUrl(url)) {
      return NextResponse.json({ error: "url host not allowed" }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: instagramFetchHeaders(url),
    });

    if (!response.ok) {
      return new Response(null, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "not an image" }, { status: 415 });
    }
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "image too large" }, { status: 413 });
    }

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
