import { NextResponse } from "next/server";
import { testProviderConnection } from "@/lib/app-settings";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      provider: string;
      config: { apiKey?: string; webhookUrl?: string; chatId?: string; botToken?: string };
    };
    if (!body.provider) {
      return NextResponse.json({ ok: false, message: "Provider is required" }, { status: 400 });
    }
    const result = await testProviderConnection(body.provider, body.config || {});
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
