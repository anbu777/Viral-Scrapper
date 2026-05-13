import { NextResponse } from "next/server";
import { getAllTemplates } from "@/lib/prompt-templates";

export async function GET() {
  return NextResponse.json(getAllTemplates());
}
