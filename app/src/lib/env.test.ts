import { describe, expect, it } from "vitest";
import { getSqlitePath, isPostgresDatabaseUrl } from "./env";

describe("env helpers", () => {
  it("resolves sqlite file URLs", () => {
    expect(getSqlitePath("file:../data/app.db")).toContain("app.db");
  });

  it("detects postgres URLs", () => {
    expect(isPostgresDatabaseUrl("postgresql://user:pass@host:5432/db")).toBe(true);
    expect(isPostgresDatabaseUrl("postgres://localhost/db")).toBe(true);
    expect(isPostgresDatabaseUrl("file:../data/app.db")).toBe(false);
  });
});
