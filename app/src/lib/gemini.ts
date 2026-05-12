const GEMINI_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

/**
 * Strips conversational/markdown preamble (e.g. "Okay, here's the analysis:")
 * that some Gemini responses include before structured output.
 *
 * Preservation rules:
 *  - If the response contains a JSON object ({...}) or markdown code fence (```),
 *    we keep it verbatim — downstream callers parse JSON / fenced output.
 *  - If the response contains a markdown heading (line starting with "# "),
 *    we trim everything before the first heading.
 *  - Otherwise we return the text unchanged so we never lose content.
 */
function stripMarkdownPreamble(text: string): string {
  if (!text) return text;
  // Preserve JSON-mode outputs intact.
  if (text.includes("```") || /\{[\s\S]*\}/.test(text)) return text;
  const match = text.match(/^[ \t]*#[ \t]+/m);
  if (!match) return text;
  const idx = text.indexOf(match[0]);
  return idx >= 0 ? text.slice(idx) : text;
}

export async function uploadVideo(
  videoBuffer: Buffer,
  mimeType: string
): Promise<{ uri: string; mimeType: string }> {
  const key = getApiKey();

  const response = await fetch(`${GEMINI_UPLOAD_URL}?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": "start, upload, finalize",
      "X-Goog-Upload-Header-Content-Length": String(videoBuffer.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": mimeType,
    },
    body: new Uint8Array(videoBuffer),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini upload error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const fileName = data.file.name; // e.g. "files/abc123"
  const fileUri = data.file.uri;
  const fileMimeType = data.file.mimeType;

  // Poll until file is ACTIVE (Gemini needs to process the upload)
  await waitForFileActive(fileName);

  return { uri: fileUri, mimeType: fileMimeType };
}

async function waitForFileActive(fileName: string, maxWaitMs = 120000): Promise<void> {
  const key = getApiKey();
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${key}`
    );

    if (!response.ok) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const data = await response.json();
    const state = data.state;

    if (state === "ACTIVE") return;
    if (state === "FAILED") throw new Error(`Gemini file processing failed for ${fileName}`);

    // Still PROCESSING — wait and retry
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(`Gemini file ${fileName} did not become ACTIVE within ${maxWaitMs / 1000}s`);
}

export async function analyzeVideo(
  fileUri: string,
  mimeType: string,
  analysisPrompt: string,
  maxRetries = 3
): Promise<string> {
  const key = getApiKey();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${GEMINI_GENERATE_URL}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { fileData: { fileUri, mimeType } },
                { text: analysisPrompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        throw new Error(`Gemini analysis error ${response.status}: ${text}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return stripMarkdownPreamble(text);
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Gemini analysis failed after retries");
}

/** Lightweight call to verify API key and network (free tier). */
export async function pingGemini(): Promise<{ ok: boolean; message: string }> {
  try {
    const key = getApiKey();
    const response = await fetch(`${GEMINI_GENERATE_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: 'Reply with JSON: {"ok":true}' }] }],
        generationConfig: { maxOutputTokens: 32 },
      }),
    });
    if (!response.ok) {
      return { ok: false, message: `Gemini HTTP ${response.status}: ${(await response.text()).slice(0, 200)}` };
    }
    return { ok: true, message: "Gemini generateContent succeeded." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function generateNewConcepts(
  videoAnalysis: string,
  newConceptsPrompt: string
): Promise<string> {
  const key = getApiKey();

  const response = await fetch(`${GEMINI_GENERATE_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `# ROLE\nYou're an expert in creating viral Reels on Instagram.\n\n# OBJECTIVE\nTake as input viral video from my competitor and based on it generate new concepts for me. Adapt this reference for me.\n\n# REFERENCE VIDEO DESCRIPTION\n------\n${videoAnalysis}\n------\n\n# MY INSTRUCTIONS FOR NEW CONCEPTS\n------\n${newConceptsPrompt}\n------\n\n# BEGIN YOUR WORK`,
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 4096 },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini concepts error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
