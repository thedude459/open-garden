import { expect, test } from "./helpers/fixtures";
import { calendarTaskItem, gotoGardenPage, uid } from "./helpers/auth";

test.describe("calendar workflow", () => {
  test("adds, filters, and completes a task", async ({ page, token, createGarden }) => {
    const taskTitle = uid("Feed seedlings");
    const garden = await createGarden({ name: uid("Task Garden"), description: "Calendar workflow test" });

    await gotoGardenPage(page, garden.id, "calendar");

    await page.getByLabel("Task Title").fill(taskTitle);
    await page.getByLabel("Task Notes").fill("Add diluted fish emulsion");
    await page.getByRole("button", { name: "Add task" }).click();

    const completeToggle = page.getByRole("checkbox", { name: new RegExp(`Mark \"${taskTitle}\" as complete`) });
    await expect(completeToggle).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "To-do" }).click();
    await expect(completeToggle).toBeVisible();

    await completeToggle.click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("checkbox", { name: new RegExp(`Mark \"${taskTitle}\" as incomplete`) })).toBeVisible();
  });

  test("deletes a task", async ({ page, token, createGarden }) => {
    const taskTitle = uid("Remove me");
    const garden = await createGarden({ name: uid("Delete Task Garden"), description: "Task deletion test" });

    await gotoGardenPage(page, garden.id, "calendar");

    await page.getByLabel("Task Title").fill(taskTitle);
    await page.getByRole("button", { name: "Add task" }).click();

    const taskItem = calendarTaskItem(page, taskTitle);
    await expect(taskItem).toBeVisible({ timeout: 10_000 });

    await taskItem.getByRole("button", { name: "Delete task" }).click();
    await expect(taskItem).not.toBeVisible({ timeout: 5_000 });
  });
});
