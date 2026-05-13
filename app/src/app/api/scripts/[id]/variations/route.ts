import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import { generateHookVariations, HOOK_STYLES } from "@/lib/script-variations";

// GET /api/scripts/:id/variations — list variations + parent
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const all = await repo.scripts.list();
    const source = all.find((s) => s.id === id);
    if (!source) return NextResponse.json({ error: "Source script not found" }, { status: 404 });

    const parentId = source.parentScriptId || source.id;
    const family = all.filter((s) => s.id === parentId || s.parentScriptId === parentId);
    family.sort((a, b) => (a.abGroup || "Z").localeCompare(b.abGroup || "Z"));

    return NextResponse.json({
      sourceId: id,
      family,
      availableStyles: Object.entries(HOOK_STYLES).map(([key, s]) => ({ key, ...s })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST /api/scripts/:id/variations — generate variations
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { count = 3, styles } = body as { count?: number; styles?: string[] };

    const all = await repo.scripts.list();
    const source = all.find((s) => s.id === id);
    if (!source) return NextResponse.json({ error: "Source script not found" }, { status: 404 });

    const created = await generateHookVariations({ sourceScript: source, count, styles });
    return NextResponse.json({ count: created.length, variations: created });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
