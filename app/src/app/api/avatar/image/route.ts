import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");

// Serves the uploaded avatar image as a raw file with correct Content-Type.
// D-ID (and other video APIs) need a publicly accessible image URL — this is it.
// In production (Vercel): https://your-app.vercel.app/api/avatar/image
// In local dev: https://xxx.ngrok.io/api/avatar/image  (run: ngrok http 3000)
export async function GET() {
  // Find avatar file in any supported format
  const candidates = ["avatar.png", "avatar.jpg", "avatar.jpeg", "avatar.webp"];
  let filePath: string | null = null;
  let mimeType = "image/png";

  for (const name of candidates) {
    const p = path.join(DATA_DIR, name);
    if (existsSync(p)) {
      filePath = p;
      const ext = name.split(".").pop()!;
      mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
      break;
    }
  }

  // Fallback: find any avatar.* file
  if (!filePath) {
    try {
      const files = readdirSync(DATA_DIR).filter((f) => f.startsWith("avatar."));
      if (files.length > 0) {
        filePath = path.join(DATA_DIR, files[0]);
        const ext = files[0].split(".").pop() ?? "png";
        mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
      }
    } catch { /* ignore */ }
  }

  if (!filePath) {
    return new NextResponse("Avatar not found. Upload an image in Voice Profile first.", { status: 404 });
  }

  const buffer = readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
