import type { Page } from "@playwright/test";

const DEFAULT_LOCATION = "97201";

export async function setTestLocationViaApi(
  page: Page,
  cityOrPostal: string = DEFAULT_LOCATION,
): Promise<void> {
  const response = await page.request.put("/api/users/me/location", {
    data: { city_or_postal: cityOrPostal },
  });
  if (!response.ok()) {
    throw new Error(`set location failed: ${response.status()} ${await response.text()}`);
  }
}
