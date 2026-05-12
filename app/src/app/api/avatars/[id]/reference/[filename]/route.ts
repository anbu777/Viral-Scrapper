import { NextRequest, NextResponse } from "next/server";
import { getReferenceImagePath } from "@/lib/avatar";
import { existsSync, readFileSync } from "fs";
import path from "path";

type Params = { params: Promise<{ id: string; filename: string }> };

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, filename } = await params;
  const filePath = getReferenceImagePath(id, filename);
  if (!existsSync(filePath)) return new NextResponse(null, { status: 404 });

  const buf = readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mime = MIME[ext] ?? "image/jpeg";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
