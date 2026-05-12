import Anthropic from "@anthropic-ai/sdk";
import { generateNewConcepts as geminiGenerateNewConcepts } from "./gemini";

/**
 * Generates new concepts from a competitor video analysis.
 *
 * Behavior:
 * - If ANTHROPIC_API_KEY is set, uses Claude Sonnet (highest quality).
 * - Otherwise, transparently falls back to Gemini (free tier).
 *
 * This makes the app fully usable on a free-tier setup (Gemini only).
 */
export async function generateNewConcepts(
  videoAnalysis: string,
  newConceptsPrompt: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return geminiGenerateNewConcepts(videoAnalysis, newConceptsPrompt);
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `# ROLE
You're an expert in creating viral short-form video content (Instagram Reels, TikTok, YouTube Shorts).

# OBJECTIVE
Take as input a viral video from my competitor and based on it generate new concepts for me. Adapt this reference for me.

# REFERENCE VIDEO DESCRIPTION
------
${videoAnalysis}
------

# MY INSTRUCTIONS FOR NEW CONCEPTS
------
${newConceptsPrompt}
------

# BEGIN YOUR WORK`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}
