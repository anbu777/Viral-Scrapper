import { describe, expect, it } from "vitest";
import { calculateViralityScore } from "./ranking";

describe("calculateViralityScore", () => {
  it("rewards creator baseline outliers", () => {
    const low = calculateViralityScore({
      platform: "instagram",
      sourcePostUrl: "https://www.instagram.com/reel/a/",
      shortcode: "a",
      creatorUsername: "creator",
      caption: "",
      thumbnailUrl: "",
      videoFileUrl: null,
      postedAt: new Date().toISOString(),
      views: 1_000,
      likes: 50,
      comments: 5,
    }, { id: "1", platform: "instagram", username: "creator", category: "x", profilePicUrl: "", followers: 10_000, reelsCount30d: 10, avgViews30d: 1_000, lastScrapedAt: "" });

    const high = calculateViralityScore({
      platform: "instagram",
      sourcePostUrl: "https://www.instagram.com/reel/b/",
      shortcode: "b",
      creatorUsername: "creator",
      caption: "",
      thumbnailUrl: "",
      videoFileUrl: null,
      postedAt: new Date().toISOString(),
      views: 10_000,
      likes: 500,
      comments: 50,
    }, { id: "1", platform: "instagram", username: "creator", category: "x", profilePicUrl: "", followers: 10_000, reelsCount30d: 10, avgViews30d: 1_000, lastScrapedAt: "" });

    expect(high.score).toBeGreaterThan(low.score);
    expect(high.reason).toContain("creator baseline");
  });
});
