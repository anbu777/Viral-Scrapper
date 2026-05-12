import { NextRequest, NextResponse } from "next/server";
import { updateScript, readScripts } from "@/lib/csv";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { action: string };
  const { action } = body;

  if (!["approve", "reject", "regenerate"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const scripts = readScripts();
  const script = scripts.find((s) => s.id === id);
  if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });

  if (action === "approve") {
    updateScript(id, { videoStatus: "approved" });
    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (action === "reject") {
    updateScript(id, { videoStatus: "rejected" });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (action === "regenerate") {
    updateScript(id, {
      videoStatus: "idle",
      videoJobId: undefined,
      videoUrl: undefined,
      geminiCheck: undefined,
      claudeCheck: undefined,
    });
    return NextResponse.json({ ok: true, status: "idle" });
  }
}
