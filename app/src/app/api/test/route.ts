import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      did: !!process.env.DID_API_KEY,
      telegram: !!process.env.TELEGRAM_BOT_TOKEN,
    }
  });
}
