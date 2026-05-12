/**
 * Extracts clean spoken dialogue from a script for TTS.
 *
 * Supports two formats:
 * 1. New simple format: ## 🎬 SPOKEN SCRIPT \n "dialogue"
 * 2. Legacy HeyGen format: block quotes > "dialogue" across multiple scenes
 *
 * Hard cap: 50 words (~15 seconds at natural speaking pace).
 */
export function extractSpokenText(scriptMarkdown: string): string {
  // ── New format: ## 🎬 SPOKEN SCRIPT \n "..."  ─────────────────────────────
  const spokenBlockMatch = scriptMarkdown.match(/##\s*🎬\s*SPOKEN SCRIPT\s*\n"([^"]+)"/s);
  if (spokenBlockMatch) {
    return truncate(spokenBlockMatch[1].trim());
  }

  // ── Legacy format: extract all block-quoted dialogue lines ────────────────
  // Cut off at production notes — nothing after this is spoken
  const notesIdx = scriptMarkdown.search(/##\s*(🎭\s*)?PRODUCTION NOTES/i);
  const content = notesIdx >= 0 ? scriptMarkdown.slice(0, notesIdx) : scriptMarkdown;

  const lines = content.split("\n");
  const spoken: string[] = [];

  for (const raw of lines) {
    let line = raw.trim();
    if (line.startsWith("#")) continue;
    if (/^-{3,}$/.test(line)) continue;
    if (/^\*\*(Visual Cue|Timing|Platform|Background|Music|Pace|Gestures|Avatar|Text Overlay|Energy)[^:]*:\*\*/i.test(line)) continue;
    if (/^(Visual Cue|Timing|Platform|Energy):/i.test(line)) continue;

    line = line.replace(/\[([^\]]*)\]/g, "").trim();
    line = line.replace(/\*\*/g, "").replace(/\*/g, "").trim();

    const blockQuoteMatch = line.match(/^>\s*"(.+)"$/);
    if (blockQuoteMatch) { spoken.push(blockQuoteMatch[1].trim()); continue; }

    const inlineQuoteMatch = line.match(/^"(.+)"$/);
    if (inlineQuoteMatch) { spoken.push(inlineQuoteMatch[1].trim()); continue; }

    if (line.length < 3) continue;
    if (line.startsWith("[") || line.startsWith(">") || line.startsWith("|")) continue;

    spoken.push(line);
  }

  const joined = spoken.filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
  return truncate(joined);
}

/** Hard cap at 50 words (~15 seconds). Truncates at nearest sentence boundary. */
function truncate(text: string): string {
  const words = text.split(/\s+/);
  if (words.length <= 50) return text;

  const clipped = words.slice(0, 50).join(" ");
  const last = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  return last > clipped.length * 0.6 ? clipped.slice(0, last + 1).trim() : clipped.trim();
}
