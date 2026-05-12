import { NextRequest, NextResponse } from "next/server";
import { readAvatarVoiceProfile, writeAvatarVoiceProfile } from "@/lib/avatar";
import type { VoiceProfile } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const DEFAULTS: VoiceProfile = {
  niche: "Business / Finance",
  tone: "",
  targetAudience: "",
  phrases: "",
  avoidPhrases: "",
  contentGoal: "",
  cta: "",
  sampleContent: "",
  heygenAvatarStyle: "professional presenter",
  avatarUrls: [],
};

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const profile = readAvatarVoiceProfile(id);
  return NextResponse.json(profile ?? DEFAULTS);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json() as Partial<VoiceProfile>;
  const existing = readAvatarVoiceProfile(id) ?? DEFAULTS;
  const updated: VoiceProfile = {
    niche: body.niche ?? existing.niche,
    tone: body.tone ?? existing.tone,
    targetAudience: body.targetAudience ?? existing.targetAudience,
    phrases: body.phrases ?? existing.phrases,
    avoidPhrases: body.avoidPhrases ?? existing.avoidPhrases,
    contentGoal: body.contentGoal ?? existing.contentGoal,
    cta: body.cta ?? existing.cta,
    sampleContent: body.sampleContent ?? existing.sampleContent,
    heygenAvatarStyle: body.heygenAvatarStyle ?? existing.heygenAvatarStyle,
    avatarUrls: body.avatarUrls ?? existing.avatarUrls ?? [],
  };
  writeAvatarVoiceProfile(id, updated);
  return NextResponse.json({ success: true, profile: updated });
}
