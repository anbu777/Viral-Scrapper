import { NextRequest, NextResponse } from "next/server";
import { discoverCreators, isExternalDiscoveryAvailable } from "@/lib/niche-discovery";
import type { SocialPlatform } from "@/lib/types";

export async function GET() {
  try {
    const externalAvailable = await isExternalDiscoveryAvailable();
    return NextResponse.json({
      externalAvailable,
      modes: ["videos"],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const keyword = String(body.keyword || "").trim();
    if (!keyword) return NextResponse.json({ error: "keyword required" }, { status: 400 });

    const platform = (body.platform || "all") as SocialPlatform | "all";
    const maxCreators = Math.min(50, parseInt(body.maxCreators, 10) || 20);

    const creators = await discoverCreators({ keyword, platform, maxCreators });
    return NextResponse.json({ keyword, count: creators.length, creators });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
