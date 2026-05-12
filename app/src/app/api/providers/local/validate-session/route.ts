import { NextResponse } from "next/server";
import { localProvider } from "@/lib/providers/local-provider";

export async function POST() {
  return NextResponse.json(await localProvider.validateSession());
}
