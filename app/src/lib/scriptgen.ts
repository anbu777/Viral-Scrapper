import { generateNewConcepts } from "./gemini";
import type { VoiceProfile } from "./types";

export interface GeneratedScript {
  title: string;
  hook: string;
  script: string;
  estimatedDuration: string;
  contentType: string;
  platform: string;
}

/**
 * Generates a short AI avatar script by duplicating the viral video's format
 * with the creator's identity and niche — same hook structure, same length,
 * just swapping in this avatar.
 *
 * Target: match the original video's duration. Hard cap at 15 seconds.
 * Output is intentionally simple — just the spoken words.
 */
export async function generatePersonalizedScript(
  videoAnalysis: string,
  voiceProfile: VoiceProfile,
  platform: string = "instagram"
): Promise<GeneratedScript> {

  const prompt = `# TASK
You are adapting a viral social media video so it can be recreated with an AI avatar.

The goal is NOT to write a completely new script. The goal is to:
1. Extract what made the original video go viral (the hook wording, the format, the energy)
2. Swap in this avatar's identity and niche — same hook STRUCTURE, same video length, just their content
3. Output ONLY the spoken words the avatar will say — nothing else

Think of it as: "What would this creator say if they made this exact video?"

---

# ORIGINAL VIDEO ANALYSIS
${videoAnalysis}

---

# THIS AVATAR'S PROFILE
- **Niche:** ${voiceProfile.niche}
- **Tone:** ${voiceProfile.tone}
- **Target Audience:** ${voiceProfile.targetAudience}
- **Phrases they use:** ${voiceProfile.phrases || "none"}
- **Phrases to AVOID:** ${voiceProfile.avoidPhrases || "none"}
- **CTA style:** ${voiceProfile.cta || "follow for more"}

# SAMPLE OF THEIR VOICE
${voiceProfile.sampleContent || "(no sample — use niche and tone above)"}

---

# DURATION RULE (CRITICAL)
Look at the original video analysis and estimate how long the original video was.
- If original was ~5–7s → your script should be ~5–7s spoken (≈10–15 words)
- If original was ~10–15s → match it (≈20–35 words)
- If original was ~20–30s → cap at 15s (≈35–45 words)
- If original was 30s+ → cap at 15s (≈35–45 words)
HARD MAX: 45 spoken words total. Count them. If over 45, cut.

---

# OUTPUT FORMAT
Output ONLY this structure — nothing else, no extra commentary:

## 📌 SCRIPT TITLE
[5 words max — what this video is about]

## ⏱ ESTIMATED DURATION
[X seconds]

## 📂 CONTENT TYPE
[one of: Hook & Reveal, Quick Tip, Personal Moment, Soft Endorsement, Relatable Moment, Aesthetic Vlog]

## 🎬 SPOKEN SCRIPT
"[Everything the avatar says — word for word, one continuous block. Natural spoken language. Match the original video's energy and pacing.]"

---

# RULES
- The spoken script is the ONLY thing that goes in quotes
- Do NOT add scene labels, visual cues, timing markers, or production notes
- Do NOT pad the script to make it longer — shorter is better
- The hook line should mirror the original's hook format (same first-word energy, same tension style)
- If the original was a vlog-style video with no talking, write 1 casual observation line in the avatar's voice
- Sound like a real person, not a script`;

  const fullText = await generateNewConcepts(videoAnalysis, prompt);

  const titleMatch = fullText.match(/##\s*📌\s*SCRIPT TITLE\s*\n([^\n]+)/);
  const durationMatch = fullText.match(/##\s*⏱\s*ESTIMATED DURATION\s*\n([^\n]+)/);
  const contentTypeMatch = fullText.match(/##\s*📂\s*CONTENT TYPE\s*\n([^\n]+)/);
  const spokenMatch = fullText.match(/##\s*🎬\s*SPOKEN SCRIPT\s*\n"([^"]+)"/s);

  // Hook = first sentence of the spoken script
  const spokenText = spokenMatch?.[1]?.trim() ?? "";
  const hookSentence = spokenText.split(/(?<=[.!?])\s+/)[0] ?? spokenText;

  return {
    title: titleMatch?.[1]?.trim() ?? "Generated Script",
    hook: hookSentence.trim(),
    script: fullText,
    estimatedDuration: durationMatch?.[1]?.trim() ?? "15 seconds",
    contentType: contentTypeMatch?.[1]?.trim() ?? "Quick Tip",
    platform,
  };
}
