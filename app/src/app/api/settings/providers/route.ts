import { NextResponse } from "next/server";
import { getProviderSettingsMasked, saveProviderSettings, applySettingsToEnv } from "@/lib/app-settings";
import type { ProviderSettings } from "@/lib/app-settings";

export async function GET() {
  try {
    const settings = await getProviderSettingsMasked();
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ProviderSettings>;

    // If any API key value contains masking dots (•), drop it so we don't overwrite real key with mask
    const cleaned = JSON.parse(JSON.stringify(body, (_key, value) => {
      if (typeof value === "string" && value.includes("•")) return undefined;
      return value;
    })) as Partial<ProviderSettings>;

    await saveProviderSettings(cleaned);
    await applySettingsToEnv();
    const fresh = await getProviderSettingsMasked();
    return NextResponse.json({ success: true, settings: fresh });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
