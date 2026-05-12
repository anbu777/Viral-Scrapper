import { describe, expect, it, vi } from "vitest";
import { withBackoff } from "./retry";

describe("withBackoff", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue(42);
    await expect(withBackoff(fn, { retries: 2 })).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("429 rate"))
      .mockResolvedValueOnce("ok");
    await expect(withBackoff(fn, { retries: 3, baseMs: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
