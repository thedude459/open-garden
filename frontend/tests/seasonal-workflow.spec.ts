import { expect, test } from "./helpers/fixtures";
import { waitForGardenListed } from "./helpers/api";
import { gotoGardenPage, uid } from "./helpers/auth";

test.describe("seasonal plan workflow", () => {
  test("toggles suggestion categories and refreshes the plan", async ({ page, request, token, createGarden }) => {
    const garden = await createGarden({ name: uid("Seasonal Garden") });

    await waitForGardenListed(request, token, garden.id);
    await gotoGardenPage(page, garden.id, "seasonal");
    await expect(page.getByRole("heading", { name: new RegExp(`Seasonal Plan.*${garden.name}`, "i") })).toBeVisible({
      timeout: 20_000,
    });

    const categoryGroup = page.getByRole("group", { name: "Plant categories for suggestions" });
    await expect(categoryGroup).toBeVisible({ timeout: 15_000 });

    const flowersChip = categoryGroup.getByRole("button", { name: "Flowers" });
    await expect(flowersChip).toHaveAttribute("aria-pressed", "true");
    await flowersChip.click();
    await expect(flowersChip).toHaveAttribute("aria-pressed", "false", { timeout: 10_000 });
    await flowersChip.click();
    await expect(flowersChip).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });

    await page.getByRole("button", { name: "Refresh Plan" }).click();
    await expect(
      page
        .getByText(/Building seasonal plan|No seasonal plan data yet|Current Signals|Growth Stage Tracking/i)
        .first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
