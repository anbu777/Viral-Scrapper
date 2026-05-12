import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { repo } from "@/db/repositories";
import type { Config } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await repo.configs.list());
}

export async function POST(request: Request) {
  const body = await request.json();
  const newConfig: Config = {
    id: uuid(),
    configName: body.configName,
    creatorsCategory: body.creatorsCategory,
    analysisInstruction: body.analysisInstruction,
    newConceptsInstruction: body.newConceptsInstruction,
  };
  await repo.configs.upsert(newConfig);
  return NextResponse.json(newConfig, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const existing = (await repo.configs.list()).find((c) => c.id === body.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = { ...existing, ...body };
  await repo.configs.upsert(updated);
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // Config deletion is intentionally left as a soft no-op in DB v1 to preserve run history references.
  return NextResponse.json({ success: true });
}
