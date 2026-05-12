/**
 * Prompt generator — fills prompt library templates with AI-generated variables.
 *
 * Claude reads the script content and voice profile, then freely generates
 * context-appropriate outfit, background, motion, and dialogue values.
 * No preset lists — works for any avatar regardless of gender, niche, or style.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readPromptLibrary, readVoiceProfile } from "./csv";
import { generateNewConcepts as geminiGenerate } from "./gemini";
import type { Script } from "./types";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/**
 * Generates JSON text using Claude (preferred) or Gemini (free fallback).
 * Both providers receive the same system + user prompt and are expected to
 * return raw JSON (no markdown fences).
 */
async function generateJsonWithFallback(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    return response.content[0]?.type === "text" ? response.content[0].text : "";
  }

  const merged = `${systemPrompt}\n\n${userPrompt}\n\nReturn ONLY valid JSON. No markdown, no code fences, no explanation.`;
  return geminiGenerate("", merged);
}

function parseJsonLoose<T>(text: string, label: string): T {
  const cleaned = text.replace(/```(?:json)?\n?/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new Error(`promptgen: failed to parse ${label} response: ${cleaned.slice(0, 200)}`);
  }
}

export interface FilledPrompts {
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt?: string;
  outfit: string;
  background: string;
  motion: string;
  dialogue: string;
  framing: "full_body" | "upper_body" | "head_and_shoulders";
  actionType: "talking_head" | "action" | "mixed";
}

/**
 * Generates filled image + video prompts for a given script.
 * Claude freely generates the variable values based on the script and voice profile.
 */
export async function generateFilledPrompts(script: Script): Promise<FilledPrompts> {
  const library = readPromptLibrary();
  if (!library) {
    throw new Error("Prompt library not found. Set it up at /prompt-library.");
  }

  const voiceProfile = readVoiceProfile();

  const systemPrompt = `You are a creative director for short-form UGC video content. Given a script and an avatar's profile, you generate the visual context variables for image and video generation prompts.

Fill in these 4 variables:
- outfit: specific clothing description that fits the script's niche and topic (e.g. "Casual white ribbed crop top and high-waist beige linen trousers")
- background: specific scene/environment description (e.g. "Aesthetic minimal bedroom studio with warm soft lighting and neutral tones")
- motion: natural UGC-style movement description for the video — describe specific subtle actions like head tilts, hand gestures, posture shifts. Keep it human and unscripted (e.g. "Natural slight head tilt while speaking, soft hand gesture near collarbone, relaxed shoulders, occasional glance down then back to camera")
- dialogue: take the script hook and rewrite it as 1–2 short natural spoken sentences, max 25 words, conversational UGC tone — this is what the avatar will say on camera

Return ONLY valid JSON with those 4 keys. No markdown, no explanation.`;

  const userPrompt = `Script title: ${script.title}
Script hook: ${script.hook}
Content type: ${script.contentType}
Estimated duration: ${script.estimatedDuration}
${voiceProfile ? `
Avatar niche: ${voiceProfile.niche}
Tone: ${voiceProfile.tone}
Target audience: ${voiceProfile.targetAudience}
Content goal: ${voiceProfile.contentGoal}` : ""}

Script excerpt:
${script.script.slice(0, 600)}

Generate the 4 visual variables. The outfit and background should feel authentic and specific to this content — not generic. The motion should be natural UGC talking-head style. The dialogue should come from the hook, kept under 25 words.

Respond with ONLY:
{"outfit":"...","background":"...","motion":"...","dialogue":"..."}`;

  const text = await generateJsonWithFallback(systemPrompt, userPrompt, 400);
  const vars = parseJsonLoose<{ outfit: string; background: string; motion: string; dialogue: string }>(text, "filled-prompts");

  const imagePrompt = fillTemplate(library.imagePromptTemplate, {
    outfit: vars.outfit,
    background: vars.background,
  });

  const videoPrompt = fillTemplate(library.videoPromptTemplate, {
    outfit: vars.outfit,
    background: vars.background,
    background_or_scene: vars.background,  // video template uses {background_or_scene}
    motion: vars.motion,
    dialogue: vars.dialogue,
  });

  return {
    imagePrompt,
    videoPrompt,
    outfit: vars.outfit,
    background: vars.background,
    motion: vars.motion,
    dialogue: vars.dialogue,
    framing: "head_and_shoulders",   // script-mode is always talking-head UGC
    actionType: "talking_head",
  };
}

/**
 * Generates filled image + video prompts to recreate a competitor video with our avatar.
 * Claude reads the Gemini analysis and generates matching visual context variables.
 *
 * Key difference from generateFilledPrompts:
 * - Extracts framing (full_body / upper_body / head_and_shoulders) based on original video's action
 * - Extracts actionType (talking_head / action / mixed)
 * - For action/mixed videos: builds a tight Kling-optimized prompt instead of the UGC template
 *   (the UGC template is designed for talking-head only and causes blurry results for motion)
 */
export async function generateFilledPromptsFromVideo(
  video: import("./types").Video,
  avatarProfile?: import("./types").AvatarProfile | null
): Promise<FilledPrompts> {
  const library = readPromptLibrary();
  if (!library) {
    throw new Error("Prompt library not found. Set it up at /prompt-library.");
  }

  const systemPrompt = `You are a creative director for short-form UGC video content and an expert in AI video generation prompting (specifically Kling 3.0 image-to-video).

Given a Gemini analysis of a competitor's viral Instagram Reel, generate variables to recreate the exact same video with an AI avatar.

Fill in these 6 variables:

- outfit: specific clothing matching the original video (e.g. "Casual beige ribbed tank top, high-waist linen trousers, white sneakers")
- background: exact same environment/scene as original (e.g. "Bright outdoor park path, afternoon sunlight, green trees")
- motion: SPECIFIC movement description for Kling video generation — describe EXACTLY what the person is doing from the very first frame. If running: "Full body running at steady pace, natural arm swing, heel-to-toe stride, looking forward". If talking: "Slight head tilt while speaking, hand gesture near collarbone". Be very specific about body movement.
- dialogue: 1–2 short spoken lines (max 25 words) matching the original topic, conversational UGC tone
- framing: MUST be one of exactly: "full_body", "upper_body", or "head_and_shoulders"
  - "full_body" → original video shows legs, running, dancing, walking, full body movement
  - "upper_body" → waist-up, standing/sitting, some arm movement
  - "head_and_shoulders" → talking head, close-up face/shoulders only
- actionType: MUST be one of exactly: "talking_head", "action", or "mixed"
  - "talking_head" → person just speaks to camera, minimal body movement
  - "action" → significant physical movement (running, dancing, walking, exercising, etc.)
  - "mixed" → talking while moving, demonstrating something, etc.

Return ONLY valid JSON with those 6 keys. No markdown, no explanation.`;

  const userPrompt = `Competitor video analysis:
Creator: @${video.creator}
Views: ${video.views.toLocaleString()}
${video.datePosted ? `Date posted: ${video.datePosted}` : ""}

${video.analysis}
${avatarProfile ? `
Our avatar:
Name: ${avatarProfile.name}
Niche: ${avatarProfile.niche}
Gender: ${avatarProfile.gender}` : ""}

Generate 6 variables to recreate this video. The motion description is critical — be specific about what the body is doing from frame 1.

Respond with ONLY:
{"outfit":"...","background":"...","motion":"...","dialogue":"...","framing":"...","actionType":"..."}`;

  const text = await generateJsonWithFallback(systemPrompt, userPrompt, 500);
  const vars = parseJsonLoose<{
    outfit: string;
    background: string;
    motion: string;
    dialogue: string;
    framing: "full_body" | "upper_body" | "head_and_shoulders";
    actionType: "talking_head" | "action" | "mixed";
  }>(text, "filled-prompts-from-video");

  // Normalize framing/actionType in case Claude returns something unexpected
  const framing = (["full_body", "upper_body", "head_and_shoulders"].includes(vars.framing)
    ? vars.framing : "upper_body") as FilledPrompts["framing"];
  const actionType = (["talking_head", "action", "mixed"].includes(vars.actionType)
    ? vars.actionType : "talking_head") as FilledPrompts["actionType"];

  // ── Image prompt: prepend the required framing so the start frame matches the action ──────
  // PhotoMaker/Flux PuLID default to close-up portraits; we override that here.
  const framingPrefix = framing === "full_body"
    ? "Full body shot, entire person visible from head to feet. "
    : framing === "upper_body"
    ? "Upper body shot, waist to head, both arms visible. "
    : "Portrait shot, head and shoulders. ";

  const imagePrompt = framingPrefix + fillTemplate(library.imagePromptTemplate, {
    outfit: vars.outfit,
    background: vars.background,
  });

  // ── Video prompt: use a tight Kling-optimized prompt for action/mixed videos ──────────────
  // The full UGC template is designed for talking-head videos only — it produces blurry/static
  // results for action videos because Kling doesn't know what the body should be doing.
  let videoPrompt: string;
  let negativePrompt: string;

  if (actionType === "talking_head") {
    // Use the full library template — it's designed exactly for this
    videoPrompt = fillTemplate(library.videoPromptTemplate, {
      outfit: vars.outfit,
      background: vars.background,
      background_or_scene: vars.background,
      motion: vars.motion,
      dialogue: vars.dialogue,
    });
    negativePrompt = "static, frozen, blurry, low quality, deformed body, identity drift, morphed face";
  } else {
    // Action / mixed: build a concise Kling-focused prompt
    // Long templates confuse the model for physical motion — use clear imperative language
    const genderWord = avatarProfile?.gender === "male" ? "man" : "woman";
    videoPrompt =
      `${framing === "full_body" ? "Full body shot. " : framing === "upper_body" ? "Upper body shot. " : ""}` +
      `A ${genderWord} wearing ${vars.outfit}. ` +
      `${vars.motion}. ` +
      `Setting: ${vars.background}. ` +
      `Motion starts immediately from the first frame — no static opening. ` +
      `Photorealistic, identity consistent across all frames, smooth natural movement, ` +
      `handheld UGC camera style.`;

    negativePrompt =
      "static opening, frozen face, blurry motion, identity drift, morphed face, deformed body, " +
      "slow motion start, black frames, fade in, extra limbs, flickering, low quality, watermark";
  }

  console.log(`[promptgen] actionType=${actionType} framing=${framing}`);
  console.log(`[promptgen] videoPrompt: ${videoPrompt.slice(0, 150)}...`);

  return {
    imagePrompt,
    videoPrompt,
    negativePrompt,
    outfit: vars.outfit,
    background: vars.background,
    motion: vars.motion,
    dialogue: vars.dialogue,
    framing,
    actionType,
  };
}
