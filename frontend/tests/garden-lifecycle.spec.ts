import { expect, test } from "./helpers/fixtures";
import { gotoHome, uid } from "./helpers/auth";

test.describe("garden lifecycle", () => {
  test("deletes a garden from the home sidebar", async ({ page, createGarden }) => {
    const garden = await createGarden({
      name: uid("Delete Me Garden"),
      yard_width_ft: 12,
      yard_length_ft: 12,
    });

    await gotoHome(page);

    const deleteButton = page.getByRole("button", { name: `Delete ${garden.name}` });
    await deleteButton.scrollIntoViewIfNeeded();
    await expect(deleteButton).toBeVisible({ timeout: 15_000 });
    await deleteButton.click();

    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "Delete garden", exact: true }).click();

    await expect(page.getByRole("button", { name: `Select garden ${garden.name}` })).not.toBeVisible({
      timeout: 15_000,
    });
  });
});
