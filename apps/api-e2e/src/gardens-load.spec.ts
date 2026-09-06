import { afterAll, describe, expect, it } from 'vitest';
import {
  createDb,
  GardenMembershipRepository,
  GardenRepository,
  users,
} from '@open-garden/plant-catalog-data';
import { GardenService } from '@open-garden/gardens';

const databaseUrl = process.env['DATABASE_URL'];

describe.skipIf(!databaseUrl)('garden list assembly budget', () => {
  const { db, pool } = createDb(databaseUrl!);
  const gardens = new GardenService(new GardenRepository(db), new GardenMembershipRepository(db));

  afterAll(async () => {
    await pool.end();
  });

  it('assembles 20 gardens in under 1000ms and not ~20× a 1-garden list', async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `load-list-${Date.now()}@example.com`,
        passwordHash: 'x',
        displayName: 'Load',
      })
      .returning();
    if (!user) throw new Error('failed to insert user');

    const first = await gardens.create(user.id, { name: 'Solo garden' });
    const oneStart = Date.now();
    await gardens.list(user.id, 1, 1);
    const oneMs = Date.now() - oneStart;

    for (let i = 1; i < 20; i++) {
      await gardens.create(user.id, { name: `Garden ${String(i).padStart(2, '0')}` });
    }
    const twentyStart = Date.now();
    const page = await gardens.list(user.id, 1, 20);
    const twentyMs = Date.now() - twentyStart;
    expect(page.items).toHaveLength(20);
    expect(page.items.every((g) => g.bedCount === 0 && g.placementCount === 0)).toBe(true);
    expect(page.items.find((g) => g.id === first.id)).toBeTruthy();
    expect(twentyMs, `garden.list.assembly_ms=${twentyMs}`).toBeLessThan(1000);
    expect(
      twentyMs,
      `garden.list.assembly_ms=${twentyMs} one_garden_ms=${oneMs}`,
    ).toBeLessThan(Math.max(50, oneMs * 8));
  });
});
