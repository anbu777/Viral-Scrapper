import { NextRequest, NextResponse } from "next/server";
import { listAvatars, createAvatar } from "@/lib/avatar";

export async function GET() {
  const avatars = listAvatars();
  return NextResponse.json(avatars);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = (body.id ?? body.name ?? "avatar")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);

  const avatar = createAvatar({ ...body, id });
  return NextResponse.json(avatar);
}
