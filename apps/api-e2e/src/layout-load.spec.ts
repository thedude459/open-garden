import { afterAll, describe, expect, it } from 'vitest';
import {
  AreaRepository,
  BedRepository,
  createDb,
  GardenMembershipRepository,
  GardenRepository,
  PlantingRepository,
  PlantRepository,
  users,
} from '@open-garden/plant-catalog-data';
import { GardenService } from '@open-garden/gardens';
import { LayoutService } from '@open-garden/garden-layout';

const databaseUrl = process.env['DATABASE_URL'];

describe.skipIf(!databaseUrl)('layout assembly budget', () => {
  const { db, pool } = createDb(databaseUrl!);
  const gardens = new GardenService(new GardenRepository(db), new GardenMembershipRepository(db));
  const layouts = new LayoutService(
    new GardenMembershipRepository(db),
    new PlantingRepository(db),
    new BedRepository(db),
    new AreaRepository(db),
  );
  const plants = new PlantRepository(db);
  const beds = new BedRepository(db);
  const plantings = new PlantingRepository(db);

  afterAll(async () => {
    await pool.end();
  });

  it('assembles a 100-placement layout in under 1000ms', async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `load-layout-${Date.now()}@example.com`,
        passwordHash: 'x',
        displayName: 'Load',
      })
      .returning();
    if (!user) throw new Error('failed to insert user');

    const garden = await gardens.create(user.id, { name: 'Load layout' });
    const plant = await plants.upsertByVarietyKey({
      varietyKey: `load-layout-${Date.now()}`,
      commonName: 'Load Tomato',
      species: 'Solanum lycopersicum',
      cultivar: 'Load',
      plantType: 'vegetable',
      zoneMin: 4,
      zoneMax: 10,
      sunRequirements: null,
      waterNeeds: null,
      daysToMaturity: 70,
      spacingInches: 12,
      provider: 'fixture',
      providerExternalId: 'load-tomato',
    });
    if (!plant) throw new Error('failed to upsert plant');

    const bed = await beds.insert({
      gardenId: garden.id,
      name: 'Load bed',
      nameNormalized: 'load bed',
      originXInches: 0,
      originYInches: 0,
      lengthInches: 240,
      widthInches: 240,
      orientation: 0,
    });

    for (let i = 0; i < 100; i++) {
      const row = await plantings.insert({
        gardenId: garden.id,
        plantId: plant.id,
        bedId: bed.id,
        plantedOn: null,
        harvestedOn: null,
      });
      await plantings.setPlacement(garden.id, row.id, {
        bedId: bed.id,
        xInches: 12 + (i % 10) * 18,
        yInches: 12 + Math.floor(i / 10) * 18,
      });
    }

    const started = Date.now();
    const layout = await layouts.get(user.id, garden.id);
    const ms = Date.now() - started;
    expect(layout.plantings.filter((p) => p.placement).length).toBe(100);
    expect(ms, `garden.layout.assembly_ms=${ms}`).toBeLessThan(1000);
  });
});
