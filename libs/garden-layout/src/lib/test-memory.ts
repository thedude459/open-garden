import type { GardenRole, LayoutPutDto } from '@open-garden/shared-types';
import { LayoutService } from './layout-service';

const tomato = {
  id: 'plant-tomato',
  commonName: 'Cherry Tomato',
  species: 'Solanum lycopersicum',
  cultivar: 'Cherry',
  plantType: 'vegetable' as const,
  status: 'active' as const,
  spacingInches: 24,
};

const basil = {
  id: 'plant-basil',
  commonName: 'Sweet Basil',
  species: 'Ocimum basilicum',
  cultivar: null,
  plantType: 'herb' as const,
  status: 'active' as const,
  spacingInches: 12,
};

const unknown = {
  id: 'plant-unknown',
  commonName: 'Mystery',
  species: 'Unknown sp.',
  cultivar: null,
  plantType: 'herb' as const,
  status: 'active' as const,
  spacingInches: null as number | null,
};

const maple = {
  id: 'plant-maple',
  commonName: 'Red Maple',
  species: 'Acer rubrum',
  cultivar: null,
  plantType: 'tree' as const,
  status: 'deprecated' as const,
  spacingInches: 36,
};

export function createLayoutMemory() {
  const ownerId = 'owner-1';
  const viewerId = 'viewer-1';
  const strangerId = 'stranger-1';
  const gardenId = 'garden-1';
  const plants = new Map<
    string,
    {
      id: string;
      commonName: string;
      species: string;
      cultivar: string | null;
      plantType: 'vegetable' | 'herb' | 'tree';
      status: 'active' | 'deprecated';
      spacingInches: number | null;
    }
  >([
    [tomato.id, tomato],
    [basil.id, basil],
    [unknown.id, unknown],
    [maple.id, maple],
  ]);
  const memberships = new Map<string, { gardenId: string; userId: string; role: GardenRole }>([
    [`${gardenId}:${ownerId}`, { gardenId, userId: ownerId, role: 'owner' }],
    [`${gardenId}:${viewerId}`, { gardenId, userId: viewerId, role: 'viewer' }],
  ]);

  type BedRow = {
    id: string;
    gardenId: string;
    name: string;
    originXInches: number | null;
    originYInches: number | null;
    lengthInches: number | null;
    widthInches: number | null;
    orientation: number;
    createdAt: Date;
    updatedAt: Date;
  };
  type PlantingRow = {
    id: string;
    gardenId: string;
    plantId: string;
    bedId: string | null;
    layoutXInches: number | null;
    layoutYInches: number | null;
    createdAt: Date;
    updatedAt: Date;
  };

  const bedRows = new Map<string, BedRow>();
  const plantingRows = new Map<string, PlantingRow>();
  let seq = 0;

  function withPlant(row: PlantingRow) {
    const plant = plants.get(row.plantId)!;
    return { ...plant, ...row };
  }

  const membershipRepo = {
    async get(gId: string, userId: string) {
      return memberships.get(`${gId}:${userId}`) ?? null;
    },
  };

  const bedRepo = {
    async listByGarden(gId: string) {
      return [...bedRows.values()]
        .filter((b) => b.gardenId === gId)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async setGeometry(gId: string, id: string, geo: LayoutPutDto['beds'][0]) {
      const row = bedRows.get(id);
      if (!row || row.gardenId !== gId) return null;
      row.originXInches = geo.originXInches;
      row.originYInches = geo.originYInches;
      row.lengthInches = geo.lengthInches;
      row.widthInches = geo.widthInches;
      row.orientation = geo.orientation;
      row.updatedAt = new Date();
      return row;
    },
    async clearGeometry(gId: string, id: string) {
      const row = bedRows.get(id);
      if (!row || row.gardenId !== gId) return null;
      row.originXInches = null;
      row.originYInches = null;
      row.lengthInches = null;
      row.widthInches = null;
      row.orientation = 0;
      row.updatedAt = new Date();
      return row;
    },
  };

  const plantingRepo = {
    async listAllForLayout(gId: string) {
      return [...plantingRows.values()]
        .filter((r) => r.gardenId === gId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(withPlant);
    },
    async setPlacement(
      gId: string,
      id: string,
      placement: { bedId: string; xInches: number; yInches: number },
    ) {
      const row = plantingRows.get(id);
      if (!row || row.gardenId !== gId) return null;
      row.bedId = placement.bedId;
      row.layoutXInches = placement.xInches;
      row.layoutYInches = placement.yInches;
      row.updatedAt = new Date();
      return row;
    },
    async clearLayoutCoords(gId: string, id: string) {
      const row = plantingRows.get(id);
      if (!row || row.gardenId !== gId) return null;
      row.layoutXInches = null;
      row.layoutYInches = null;
      row.updatedAt = new Date();
      return row;
    },
  };

  const service = new LayoutService(
    membershipRepo as never,
    plantingRepo as never,
    bedRepo as never,
  );

  function addBed(name: string, id?: string) {
    const now = new Date();
    const row: BedRow = {
      id: id ?? `bed-${++seq}`,
      gardenId,
      name,
      originXInches: null,
      originYInches: null,
      lengthInches: null,
      widthInches: null,
      orientation: 0,
      createdAt: now,
      updatedAt: now,
    };
    bedRows.set(row.id, row);
    return row;
  }

  function addPlanting(plantId: string, bedId: string | null = null) {
    const now = new Date();
    const row: PlantingRow = {
      id: `planting-${++seq}`,
      gardenId,
      plantId,
      bedId,
      layoutXInches: null,
      layoutYInches: null,
      createdAt: now,
      updatedAt: now,
    };
    plantingRows.set(row.id, row);
    return row;
  }

  return {
    service,
    ownerId,
    viewerId,
    strangerId,
    gardenId,
    addBed,
    addPlanting,
    tomato,
    basil,
    unknown,
    maple,
  };
}
