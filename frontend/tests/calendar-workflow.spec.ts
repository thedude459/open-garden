import { expect, test } from "@playwright/test";

import { getAuthToken, loadAuthenticated, uid } from "./helpers/auth";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

test.describe("calendar workflow", () => {
  test("adds, filters, and completes a task", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const gardenName = uid("Task Garden");
    const taskTitle = uid("Feed seedlings");

    const gardenResponse = await request.post(`${API}/gardens`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: gardenName,
        description: "Calendar workflow test",
        zip_code: "94110",
        yard_width_ft: 20,
        yard_length_ft: 20,
      },
    });
    expect(gardenResponse.ok()).toBeTruthy();

    await loadAuthenticated(page, token);
    await expect(page.getByRole("button", { name: "Calendar", exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Calendar", exact: true }).click();

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
  test("deletes a task", async ({ page, request }) => {
    const token = await getAuthToken(request);
    const taskTitle = uid("Remove me");

    const gardenResponse = await request.post(`${API}/gardens`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: uid("Delete Task Garden"),
        description: "Task deletion test",
        zip_code: "94110",
        yard_width_ft: 20,
        yard_length_ft: 20,
      },
    });
    expect(gardenResponse.ok()).toBeTruthy();

    await loadAuthenticated(page, token);
    await expect(page.getByRole("button", { name: "Calendar", exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Calendar", exact: true }).click();

    await page.getByLabel("Task Title").fill(taskTitle);
    await page.getByRole("button", { name: "Add task" }).click();

    const taskPill = page.locator(".event-pill", { hasText: taskTitle });
    await expect(taskPill).toBeVisible({ timeout: 10_000 });

    await taskPill.getByRole("button", { name: "Delete task" }).click();
    await expect(taskPill).not.toBeVisible({ timeout: 5_000 });
  });});