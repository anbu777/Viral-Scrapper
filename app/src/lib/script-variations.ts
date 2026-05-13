import { generateNewConcepts as geminiGenerate } from "@/lib/gemini";
import { generateNewConcepts as claudeGenerate } from "@/lib/claude";
import { repo } from "@/db/repositories";
import type { Script } from "@/lib/types";
import { randomUUID } from "crypto";

export interface HookVariationStyle {
  name: string;
  description: string;
  example: string;
}

export const HOOK_STYLES: Record<string, HookVariationStyle> = {
  question: {
    name: "Question Hook",
    description: "Open with a provocative question that makes viewers want to know the answer",
    example: "Did you know 90% of people make this mistake with their morning coffee?",
  },
  shock: {
    name: "Shock Hook",
    description: "Lead with a counter-intuitive or surprising statement that challenges common belief",
    example: "Most people are wrong about how to invest in 2026.",
  },
  story: {
    name: "Story Hook",
    description: "Begin mid-action with a personal narrative that triggers curiosity",
    example: "Last week I lost $5K trying this. Here's what actually worked.",
  },
  list: {
    name: "List Hook",
    description: "Promise a specific number of insights to deliver upfront",
    example: "3 brutal truths about productivity nobody tells you.",
  },
  contrarian: {
    name: "Contrarian Hook",
    description: "Take an unpopular stance against mainstream advice",
    example: "Stop drinking 8 glasses of water. Here's why.",
  },
};

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Variation response missing JSON");
  return JSON.parse(text.slice(start, end + 1));
}

interface VariationOutput {
  hook: string;
  spokenScript: string;
  cta: string;
  styleName: string;
}

/**
 * Generates N hook variations of an existing script.
 * Each variation has a different hook style but maintains the script's core message.
 * Saves variations to the DB with parentScriptId pointing to the source.
 */
export async function generateHookVariations(opts: {
  sourceScript: Script;
  count?: number;
  styles?: string[];
}): Promise<Script[]> {
  const { sourceScript } = opts;
  const count = opts.count ?? 3;
  const styles = opts.styles ?? ["question", "shock", "story"].slice(0, count);

  const provider: "gemini" | "claude" = process.env.ANTHROPIC_API_KEY ? "claude" : "gemini";
  const created: Script[] = [];

  for (let i = 0; i < Math.min(count, styles.length); i++) {
    const styleKey = styles[i];
    const style = HOOK_STYLES[styleKey] || HOOK_STYLES.question;

    const prompt = `You are an expert short-form video script writer.

Given this existing script:
---
Title: ${sourceScript.title}
Hook: ${sourceScript.hook}
Body: ${sourceScript.spokenScript || sourceScript.script}
CTA: ${sourceScript.cta || "Like and follow for more"}
---

Generate a NEW VARIATION using this hook style:
**${style.name}** — ${style.description}
Example pattern: "${style.example}"

Keep the core message and target audience identical. Only change the hook style and slightly adjust the opening of the body to flow from the new hook.

Return ONLY valid JSON with these keys:
{
  "hook": "<the new hook in the specified style>",
  "spokenScript": "<the full spoken script word-for-word, starting with the new hook, max 60 seconds>",
  "cta": "<the closing call to action>"
}`;

    let parsed: VariationOutput;
    try {
      const text = provider === "claude"
        ? await claudeGenerate(JSON.stringify({ source: sourceScript.spokenScript || sourceScript.script }), prompt)
        : await geminiGenerate(JSON.stringify({ source: sourceScript.spokenScript || sourceScript.script }), prompt);
      const json = extractJson(text) as Partial<VariationOutput>;
      parsed = {
        hook: json.hook || sourceScript.hook,
        spokenScript: json.spokenScript || sourceScript.spokenScript || sourceScript.script,
        cta: json.cta || sourceScript.cta || "",
        styleName: style.name,
      };
    } catch {
      parsed = {
        hook: `[${style.name}] ${sourceScript.hook}`,
        spokenScript: sourceScript.spokenScript || sourceScript.script,
        cta: sourceScript.cta || "",
        styleName: style.name,
      };
    }

    const abGroup = String.fromCharCode(65 + i + 1); // B, C, D...
    const newId = randomUUID();
    const variantScript: Script = {
      id: newId,
      videoId: sourceScript.videoId,
      generationRunId: sourceScript.generationRunId || "legacy",
      scriptVariant: sourceScript.scriptVariant,
      videoCreator: sourceScript.videoCreator,
      videoViews: sourceScript.videoViews,
      videoLink: sourceScript.videoLink,
      title: `${sourceScript.title} — ${style.name}`,
      hook: parsed.hook,
      script: parsed.spokenScript,
      spokenScript: parsed.spokenScript,
      cta: parsed.cta,
      sourceInspiration: sourceScript.sourceInspiration,
      similarityScore: sourceScript.similarityScore,
      qualityScore: sourceScript.qualityScore,
      platform: sourceScript.platform,
      estimatedDuration: sourceScript.estimatedDuration,
      estimatedDurationSeconds: sourceScript.estimatedDurationSeconds,
      contentType: sourceScript.contentType,
      dateGenerated: new Date().toISOString().slice(0, 10),
      starred: false,
      parentScriptId: sourceScript.id,
      version: (sourceScript.version || 1) + 1,
      abGroup,
    };

    // Use direct DB insert to bypass unique constraint on (videoId, scriptVariant, generationRunId)
    // by using a unique generationRunId per variation
    variantScript.generationRunId = `${sourceScript.generationRunId || "legacy"}_var_${i + 1}_${Date.now()}`;

    await repo.scripts.upsert(variantScript);
    created.push(variantScript);
  }

  // Mark source script as group "A" if not already
  if (!sourceScript.abGroup) {
    await repo.scripts.update(sourceScript.id, { abGroup: "A" } as Partial<Script>);
  }

  return created;
}
