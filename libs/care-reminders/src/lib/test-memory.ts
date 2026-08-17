import type { CareAction, CareKind, GardenRole } from '@open-garden/shared-types';
import { CareReminderService } from './care-reminder-service';

const intervalHerb = {
  id: 'plant-interval',
  commonName: 'Interval Herb',
  species: 'Herba intervalis',
  cultivar: null,
  plantType: 'herb' as const,
  status: 'active' as const,
  daysToMaturity: 45,
  waterIntervalDays: 7,
  fertilizeIntervalDays: 21,
};

const tomato = {
  id: 'plant-tomato',
  commonName: 'Cherry Tomato',
  species: 'Solanum lycopersicum',
  cultivar: 'Cherry',
  plantType: 'vegetable' as const,
  status: 'active' as const,
  daysToMaturity: 65,
  waterIntervalDays: null as number | null,
  fertilizeIntervalDays: null as number | null,
};

const deprecatedMaple = {
  id: 'plant-maple',
  commonName: 'Red Maple',
  species: 'Acer rubrum',
  cultivar: null,
  plantType: 'tree' as const,
  status: 'deprecated' as const,
  daysToMaturity: 365,
  waterIntervalDays: null as number | null,
  fertilizeIntervalDays: null as number | null,
};

type PlantingRow = {
  id: string;
  gardenId: string;
  plantId: string;
  plantedOn: string | null;
  harvestedOn: string | null;
};

type EventRow = {
  plantingId: string;
  kind: CareKind;
  occurrenceOn: string;
  action: CareAction;
};

export function createReminderMemory() {
  const ownerId = 'owner-1';
  const viewerId = 'viewer-1';
  const strangerId = 'stranger-1';
  const gardenId = 'garden-1';
  const otherGardenId = 'garden-2';

  const plants = new Map<
    string,
    {
      id: string;
      commonName: string;
      species: string;
      cultivar: string | null;
      plantType: 'vegetable' | 'herb' | 'tree';
      status: 'active' | 'deprecated';
      daysToMaturity: number;
      waterIntervalDays: number | null;
      fertilizeIntervalDays: number | null;
    }
  >([
    [intervalHerb.id, intervalHerb],
    [tomato.id, tomato],
    [deprecatedMaple.id, deprecatedMaple],
  ]);

  const memberships = new Map<string, { gardenId: string; userId: string; role: GardenRole }>([
    [`${gardenId}:${ownerId}`, { gardenId, userId: ownerId, role: 'owner' }],
    [`${gardenId}:${viewerId}`, { gardenId, userId: viewerId, role: 'viewer' }],
  ]);

  const plantings = new Map<string, PlantingRow>();
  const events = new Map<string, EventRow>();

  function plantingKey(garden: string, id: string) {
    return `${garden}:${id}`;
  }

  function eventKey(plantingId: string, kind: CareKind, occurrenceOn: string) {
    return `${plantingId}:${kind}:${occurrenceOn}`;
  }

  function withPlant(row: PlantingRow) {
    const plant = plants.get(row.plantId)!;
    return {
      id: row.id,
      plantId: row.plantId,
      commonName: plant.commonName,
      species: plant.species,
      cultivar: plant.cultivar,
      plantType: plant.plantType,
      status: plant.status,
      plantedOn: row.plantedOn,
      harvestedOn: row.harvestedOn,
      daysToMaturity: plant.daysToMaturity,
      waterIntervalDays: plant.waterIntervalDays,
      fertilizeIntervalDays: plant.fertilizeIntervalDays,
    };
  }

  const service = new CareReminderService(
    {
      getMembership: async (g, u) => {
        const row = memberships.get(`${g}:${u}`);
        return row ? { role: row.role } : null;
      },
    },
    {
      listAllForReminders: async (g) =>
        [...plantings.values()].filter((p) => p.gardenId === g).map(withPlant),
      getInGarden: async (g, id) => {
        const row = plantings.get(plantingKey(g, id));
        return row ? { id: row.id } : null;
      },
    },
    {
      listForGarden: async (g) =>
        [...events.values()]
          .filter((e) => {
            const planting = [...plantings.values()].find((p) => p.id === e.plantingId);
            return planting?.gardenId === g;
          })
          .map(({ plantingId, kind, occurrenceOn }) => ({ plantingId, kind, occurrenceOn })),
      upsert: async (plantingId, kind, occurrenceOn, action) => {
        events.set(eventKey(plantingId, kind, occurrenceOn), {
          plantingId,
          kind,
          occurrenceOn,
          action,
        });
      },
    },
  );

  return {
    service,
    ownerId,
    viewerId,
    strangerId,
    gardenId,
    otherGardenId,
    addPlanting(input: {
      id: string;
      gardenId?: string;
      plantId: string;
      plantedOn?: string | null;
      harvestedOn?: string | null;
    }) {
      const row: PlantingRow = {
        id: input.id,
        gardenId: input.gardenId ?? gardenId,
        plantId: input.plantId,
        plantedOn: input.plantedOn ?? null,
        harvestedOn: input.harvestedOn ?? null,
      };
      plantings.set(plantingKey(row.gardenId, row.id), row);
      return row;
    },
    deletePlanting(g: string, id: string) {
      plantings.delete(plantingKey(g, id));
      for (const key of [...events.keys()]) {
        if (key.startsWith(`${id}:`)) events.delete(key);
      }
    },
    getEvent(plantingId: string, kind: CareKind, occurrenceOn: string) {
      return events.get(eventKey(plantingId, kind, occurrenceOn));
    },
    getPlanting(g: string, id: string) {
      return plantings.get(plantingKey(g, id));
    },
  };
}
