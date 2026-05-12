import { NextRequest, NextResponse } from "next/server";
import { readVoiceProfile, writeVoiceProfile } from "@/lib/csv";
import type { VoiceProfile } from "@/lib/types";

// GET /api/voice-profile — fetch the saved voice profile
export async function GET() {
  const profile = readVoiceProfile();
  if (!profile) {
    // Return sensible defaults for Business/Finance niche
    const defaults: VoiceProfile = {
      niche: "Business / Finance",
      tone: "authoritative but relatable, straight-to-the-point",
      targetAudience: "Entrepreneurs and aspiring investors, 25-40",
      phrases: "",
      avoidPhrases: "",
      contentGoal: "Build authority, grow audience, drive leads",
      cta: "Follow for more business insights",
      sampleContent: "",
      heygenAvatarStyle: "professional presenter",
    };
    return NextResponse.json(defaults);
  }
  return NextResponse.json(profile);
}

// POST /api/voice-profile — save/update the voice profile
export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<VoiceProfile>;
  const existing = readVoiceProfile();

  const updated: VoiceProfile = {
    niche: body.niche ?? existing?.niche ?? "",
    tone: body.tone ?? existing?.tone ?? "",
    targetAudience: body.targetAudience ?? existing?.targetAudience ?? "",
    phrases: body.phrases ?? existing?.phrases ?? "",
    avoidPhrases: body.avoidPhrases ?? existing?.avoidPhrases ?? "",
    contentGoal: body.contentGoal ?? existing?.contentGoal ?? "",
    cta: body.cta ?? existing?.cta ?? "",
    sampleContent: body.sampleContent ?? existing?.sampleContent ?? "",
    heygenAvatarStyle: body.heygenAvatarStyle ?? existing?.heygenAvatarStyle ?? "",
    // Preserve avatarUrls — always carry forward from existing if not explicitly provided
    avatarUrls: body.avatarUrls ?? existing?.avatarUrls ?? [],
  };

  writeVoiceProfile(updated);
  return NextResponse.json({ success: true, profile: updated });
}
