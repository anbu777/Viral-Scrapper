import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateBucket = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 200;

function clientKey(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/telegram/webhook")) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected) {
      const token = req.headers.get("x-telegram-bot-api-secret-token");
      if (token !== expected) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  if (path.startsWith("/api/providers/health") && req.method === "GET") {
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    const k = clientKey(req);
    const now = Date.now();
    const b = rateBucket.get(k);
    if (!b || now > b.resetAt) {
      rateBucket.set(k, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      b.count += 1;
      if (b.count > MAX_PER_WINDOW) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
