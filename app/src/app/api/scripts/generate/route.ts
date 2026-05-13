import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readVoiceProfile } from "@/lib/csv";
import { repo } from "@/db/repositories";
import { readAvatarVoiceProfile } from "@/lib/avatar";
import { generatePersonalizedScript } from "@/lib/scriptgen";
import type { Script } from "@/lib/types";

// POST /api/scripts/generate
// Body: { videoId, videoAnalysis, videoCreator, videoViews, videoLink, platform?, avatarId? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      videoId: string;
      videoAnalysis: string;
      videoCreator: string;
      videoViews: number;
      videoLink: string;
      platform?: string;
      avatarId?: string;
    };

    const { videoId, videoAnalysis, videoCreator, videoViews, videoLink, platform = "instagram", avatarId } = body;

    if (!videoAnalysis) {
      return NextResponse.json({ error: "videoAnalysis is required" }, { status: 400 });
    }

    const sourceVideo = videoId ? await repo.videos.find(videoId) : null;
    if (sourceVideo?.analysisStatus && sourceVideo.analysisStatus !== "ok") {
      return NextResponse.json(
        { error: "Generate a successful video analysis first. Current analysis is fallback/failed." },
        { status: 409 }
      );
    }

    // Load voice profile: prefer per-avatar, fall back to global, then hardcoded defaults
    const fallback = {
      niche: "Business / Finance",
      tone: "authoritative but relatable",
      targetAudience: "Entrepreneurs 25-40",
      phrases: "",
      avoidPhrases: "",
      contentGoal: "Build authority and grow audience",
      cta: "Follow for more",
      sampleContent: "",
      heygenAvatarStyle: "professional presenter",
    };
    const voiceProfile =
      (avatarId ? readAvatarVoiceProfile(avatarId) : null) ??
      readVoiceProfile() ??
      fallback;

    // Generate the script
    const generated = await generatePersonalizedScript(videoAnalysis, voiceProfile, platform);

    // Build the Script record
    const script: Script = {
      id: uuid(),
      videoId: videoId || "",
      videoCreator: videoCreator || "",
      videoViews: videoViews || 0,
      videoLink: videoLink || "",
      title: generated.title,
      hook: generated.hook,
      script: generated.script,
      platform,
      estimatedDuration: generated.estimatedDuration,
      contentType: generated.contentType,
      dateGenerated: new Date().toISOString().slice(0, 10),
      starred: false,
      avatarId: avatarId || undefined,
    };

    await repo.scripts.upsert(script);

    return NextResponse.json({ success: true, script });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
