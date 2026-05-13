import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import { generateWeeklyReport, type WeeklyReport } from "@/lib/report-generator";

// GET /api/reports — list saved reports
export async function GET() {
  try {
    const reports = await repo.intelligenceReports.list();
    return NextResponse.json(
      reports.map((r) => {
        let parsed: WeeklyReport | null = null;
        try {
          parsed = JSON.parse(r.reportJson);
        } catch {}
        return {
          id: r.id,
          configName: r.configName,
          periodFrom: r.periodFrom,
          periodTo: r.periodTo,
          createdAt: r.createdAt,
          summary: parsed?.stats || null,
        };
      })
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST /api/reports — generate new report
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { configName, daysBack = 7 } = body as { configName?: string; daysBack?: number };

    const report = await generateWeeklyReport({ configName, daysBack });
    const saved = await repo.intelligenceReports.create({
      configName: configName || "all",
      periodFrom: report.period.from,
      periodTo: report.period.to,
      reportJson: JSON.stringify(report),
    });

    return NextResponse.json({ id: saved.id, report });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// DELETE /api/reports?id=xxx
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await repo.intelligenceReports.delete(id);
  return NextResponse.json({ success: true });
}
