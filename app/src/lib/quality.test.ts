import { describe, expect, it } from "vitest";
import { estimateDurationSeconds, normalizeAnalysis, scoreScript, similarityScore } from "./quality";

describe("quality utilities", () => {
  it("validates video analysis JSON shape", () => {
    const analysis = normalizeAnalysis({
      hook: "Stop doing this",
      summary: "A short tip",
      transcript: "Stop doing this one thing.",
      ocrText: "",
      visualPattern: "Talking head",
      pacing: "Fast",
      formatPattern: "Hook then reveal",
      audience: "Creators",
      viralMechanics: ["curiosity"],
      riskFlags: [],
      sourceEvidence: ["transcript"],
    });
    expect(analysis.hook).toBe("Stop doing this");
  });

  it("scores near-copy scripts lower", () => {
    const copy = scoreScript({
      variant: "safe",
      title: "Copy",
      hook: "Stop doing this",
      spokenScript: "Stop doing this one thing.",
      cta: "Follow for more.",
      estimatedDurationSeconds: 5,
      sourceInspiration: "hook",
      similarityScore: 0,
      qualityScore: 0,
      imagePrompt: "",
      videoPrompt: "",
    }, "Stop doing this one thing.", "strict");
    expect(copy.status).not.toBe("passed");
  });

  it("estimates duration from word count", () => {
    expect(estimateDurationSeconds("one two three four five")).toBeGreaterThan(1);
    expect(similarityScore("alpha beta", "alpha gamma")).toBeGreaterThan(0);
  });
});
