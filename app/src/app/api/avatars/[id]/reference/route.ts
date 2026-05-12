import { NextRequest, NextResponse } from "next/server";
import {
  listReferenceImages,
  saveReferenceImage,
  deleteReferenceImage,
} from "@/lib/avatar";

type Params = { params: Promise<{ id: string }> };

/** GET /api/avatars/[id]/reference — list filenames */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const files = listReferenceImages(id);
  return NextResponse.json(files);
}

/** POST /api/avatars/[id]/reference — upload one image (multipart/form-data, field: "file") */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file field" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const saved = saveReferenceImage(id, file.name, buf);
  return NextResponse.json({ filename: saved });
}

/** DELETE /api/avatars/[id]/reference?filename=xxx */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const filename = new URL(req.url).searchParams.get("filename");
  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });
  deleteReferenceImage(id, filename);
  return NextResponse.json({ success: true });
}
