import type { PlantDataProvider, ProviderPlant } from '@open-garden/plant-provider';

/** Every record from a source, and how many it skipped as unreadable. */
export async function fetchAllFromProvider(
  provider: PlantDataProvider,
): Promise<{ plants: ProviderPlant[]; skipped: number }> {
  const items: ProviderPlant[] = [];
  let skipped = 0;
  let cursor: string | undefined;
  for (let pages = 0; pages < 10_000; pages++) {
    const page = await provider.listPage({ cursor, limit: 50 });
    items.push(...page.items);
    skipped += page.skipped ?? 0;
    if (!page.nextCursor || page.items.length === 0) break;
    if (page.nextCursor === cursor) break;
    cursor = page.nextCursor;
  }
  return { plants: items, skipped };
}
