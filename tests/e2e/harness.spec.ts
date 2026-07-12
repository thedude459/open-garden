import { test, expect, registerAndLogin } from "./fixtures";

test.describe("harness", () => {
  test("seeded catalog and login fixture work", async ({ page }) => {
    await registerAndLogin(page);
    const response = await page.request.get("/api/plants/search?q=Tomato");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.results?.some((p: { common_name: string }) => p.common_name === "Tomato")).toBeTruthy();
    await page.goto("/gardens");
    await expect(page.getByRole("heading", { name: "Gardens" })).toBeVisible();
  });
});
