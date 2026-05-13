import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import { exportReportAsMarkdown, type WeeklyReport } from "@/lib/report-generator";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";

    const row = await repo.intelligenceReports.get(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let report: WeeklyReport;
    try {
      report = JSON.parse(row.reportJson);
    } catch {
      return NextResponse.json({ error: "Corrupted report" }, { status: 500 });
    }

    if (format === "markdown" || format === "md") {
      const md = exportReportAsMarkdown(report);
      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="report-${row.configName}-${row.periodFrom}.md"`,
        },
      });
    }

    return NextResponse.json({
      id: row.id,
      configName: row.configName,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      createdAt: row.createdAt,
      report,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
