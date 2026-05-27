import { expect, test } from "./helpers/fixtures";
import { gotoGardenPage, uid } from "./helpers/auth";

test.describe("ai coach workflow", () => {
  test("sends a chat message and receives a coach reply", async ({ page, token, createGarden }) => {
    const garden = await createGarden({ name: uid("Coach Garden") });
    const prompt = "What should I focus on in the garden this week?";

    await gotoGardenPage(page, garden.id, "coach");
    await expect(page.getByRole("heading", { name: new RegExp(`AI Garden Coach.*${garden.name}`) })).toBeVisible({
      timeout: 15_000,
    });

    const chatForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Send" }) });
    await chatForm.getByPlaceholder("What should I focus on this week?").fill(prompt);
    await chatForm.getByRole("button", { name: "Send" }).click();

    await expect(page.getByRole("log")).toContainText(prompt, { timeout: 10_000 });
    await expect(page.getByRole("log")).toContainText("Coach", { timeout: 20_000 });
  });
});
