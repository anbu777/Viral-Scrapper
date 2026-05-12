import { test, expect } from "@playwright/test";

test("home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});

test("health API returns JSON", async ({ request }) => {
  const res = await request.get("/api/providers/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty("database");
  expect(body).toHaveProperty("gemini");
});
