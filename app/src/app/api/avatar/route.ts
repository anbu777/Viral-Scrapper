import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const AVATAR_PATH = path.join(DATA_DIR, "avatar.png");

export async function GET() {
  if (!existsSync(AVATAR_PATH)) {
    return NextResponse.json({ exists: false });
  }
  // Return the image as base64 so the frontend can preview it
  const buffer = readFileSync(AVATAR_PATH);
  const base64 = buffer.toString("base64");
  return NextResponse.json({ exists: true, base64, mimeType: "image/png" });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

    // Always save as PNG filename but preserve original format in content
    // Store with original extension based on mime type
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
    const avatarPath = path.join(DATA_DIR, `avatar.${ext}`);

    writeFileSync(avatarPath, buffer);

    // If not png, also update the canonical path reference
    return NextResponse.json({ success: true, filename: `avatar.${ext}` });
  } catch (err) {
    console.error("[avatar/POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
