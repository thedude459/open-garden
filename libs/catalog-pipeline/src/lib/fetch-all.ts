import type { PlantDataProvider, ProviderPlant } from '@open-garden/plant-provider';

export async function fetchAllFromProvider(provider: PlantDataProvider): Promise<ProviderPlant[]> {
  const items: ProviderPlant[] = [];
  let cursor: string | undefined;
  for (let pages = 0; pages < 10_000; pages++) {
    const page = await provider.listPage({ cursor, limit: 50 });
    items.push(...page.items);
    if (!page.nextCursor || page.items.length === 0) break;
    if (page.nextCursor === cursor) break;
    cursor = page.nextCursor;
  }
  return items;
}
