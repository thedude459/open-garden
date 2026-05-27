import { expect, test } from "./helpers/fixtures";
import { getFirstGardenId } from "./helpers/api";
import {
  gotoGardenPage,
  gotoHome,
  openCreateGardenForm,
  openPlannerTab,
  uid,
  waitForGardenNav,
} from "./helpers/auth";

test.describe("open-garden smoke", () => {
  test("create a garden", async ({ page, request, token, gardenCleanup }) => {
    const gardenName = uid("PW Garden");
    await gotoHome(page);
    await openCreateGardenForm(page);

    const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Create garden" }) });
    await createForm.locator("#garden-name").fill(gardenName);
    await createForm.locator("#garden-zip-code").fill("94110");
    await createForm.locator("#garden-yard-width").fill("20");
    await createForm.locator("#garden-yard-length").fill("20");
    await createForm.getByRole("button", { name: "Create garden" }).click();

    await expect(page.getByText("Garden created.")).toBeVisible({ timeout: 20_000 });

    const apiBase = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
    let createdId: number | null = null;
    await expect
      .poll(async () => {
        const listResponse = await request.get(`${apiBase}/gardens`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!listResponse.ok()) return null;
        const gardens = (await listResponse.json()) as { id: number; name: string }[];
        createdId = gardens.find((garden) => garden.name === gardenName)?.id ?? null;
        return createdId;
      })
      .not.toBeNull();
    gardenCleanup.register(createdId!);

    const selectGarden = page.getByRole("button", { name: `Select garden ${gardenName}` }).first();
    if (await selectGarden.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await selectGarden.scrollIntoViewIfNeeded();
    }
  });

  test("navigate to calendar", async ({ page, request, token }) => {
    await getFirstGardenId(request, token);
    await gotoHome(page);
    await waitForGardenNav(page);
    await page.getByRole("button", { name: "Calendar", exact: true }).click();

    await expect(page.getByRole("heading", { name: /Season Calendar/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("navigate to bed planner", async ({ page, request, token }) => {
    await getFirstGardenId(request, token);
    await gotoHome(page);
    await waitForGardenNav(page);

    await page.getByRole("button", { name: "Bed Planner", exact: true }).click();
    await openPlannerTab(page, "Manage Plantings");

    await expect(page.getByRole("heading", { name: /Bed planner/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("heading", { name: "Bed Sheets" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("navigate to crop library", async ({ page, token }) => {
    await gotoHome(page);
    await page.getByRole("button", { name: "Crops", exact: true }).click();

    await expect(page.getByRole("heading", { name: /Crop Library/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("panel navigation after garden selection", () => {
  test("timeline shows unified timeline heading", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await gotoGardenPage(page, gardenId, "timeline");
    await expect(page.getByRole("heading", { name: /Unified Timeline/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("seasonal plan shows seasonal plan heading", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await gotoGardenPage(page, gardenId, "seasonal");
    await expect(page.getByRole("heading", { name: /Seasonal [Pp]lan/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("ai coach shows ai coach heading", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await gotoGardenPage(page, gardenId, "coach");
    await expect(page.getByRole("heading", { name: /AI Garden Coach/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("sensors shows sensor dashboard heading", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await gotoGardenPage(page, gardenId, "sensors");
    await expect(page.getByRole("heading", { name: /Sensor Dashboard/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("pest log shows pest and disease log heading", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await gotoGardenPage(page, gardenId, "pests");
    await expect(page.getByRole("heading", { name: /Pest.*Disease Log/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("calendar shows weather outlook panel", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await gotoGardenPage(page, gardenId, "calendar");
    await expect(page.getByRole("heading", { name: /Weather Outlook/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("journal shows observation journal heading", async ({ page, request, token }) => {
    const gardenId = await getFirstGardenId(request, token);
    await gotoGardenPage(page, gardenId, "journal");
    await expect(page.getByRole("heading", { name: /Observation Journal/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
