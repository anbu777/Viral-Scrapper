import { NextRequest, NextResponse } from "next/server";
import { readPromptLibrary, writePromptLibrary } from "@/lib/csv";
import type { PromptLibrary } from "@/lib/types";

export async function GET() {
  const library = readPromptLibrary();
  if (!library) {
    return NextResponse.json({ error: "Prompt library not found" }, { status: 404 });
  }
  return NextResponse.json(library);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as PromptLibrary;
  if (!body.imagePromptTemplate || !body.videoPromptTemplate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  writePromptLibrary(body);
  return NextResponse.json({ success: true });
}
