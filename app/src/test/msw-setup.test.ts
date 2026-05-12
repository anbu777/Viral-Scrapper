import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("https://example.test/msw-probe", () => HttpResponse.json({ ok: true }))
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("MSW in Vitest", () => {
  it("intercepts outbound fetch for contract-style tests", async () => {
    const res = await fetch("https://example.test/msw-probe");
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ ok: true });
  });
});
