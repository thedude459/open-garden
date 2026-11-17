import { and, desc, eq, type SQL } from 'drizzle-orm';
import type {
  NutrientLevel,
  SoilTestCreateDto,
  SoilTestDto,
  SoilTestOwner,
} from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { gardenAreas, gardenBeds, gardenSoilTests } from './schema';

type Row = typeof gardenSoilTests.$inferSelect;

function level(value: string | null): NutrientLevel | null {
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

function toDto(row: Row): SoilTestDto {
  return {
    id: row.id,
    areaId: row.areaId,
    bedId: row.bedId,
    testedOn: row.testedOn,
    lab: row.lab,
    ph: row.ph,
    organicMatterPct: row.organicMatterPct,
    nitrogen: level(row.nitrogen),
    phosphorus: level(row.phosphorus),
    potassium: level(row.potassium),
    recommendations: row.recommendations,
  };
}

function ownedBy(owner: SoilTestOwner): SQL {
  return 'bedId' in owner
    ? eq(gardenSoilTests.bedId, owner.bedId)
    : eq(gardenSoilTests.areaId, owner.areaId);
}

/** The latest date first, then the latest entered: that one speaks for its owner. */
const latestFirst = [desc(gardenSoilTests.testedOn), desc(gardenSoilTests.createdAt)];

function latestPerKey(rows: Row[], key: (row: Row) => string | null): Map<string, SoilTestDto> {
  const latest = new Map<string, SoilTestDto>();
  for (const row of rows) {
    const id = key(row);
    if (id && !latest.has(id)) latest.set(id, toDto(row));
  }
  return latest;
}

/** Soil tests of areas and beds (ADR 0033). Callers check the owner belongs to the property. */
export class SoilTestRepository {
  constructor(private readonly db: AppDatabase) {}

  async insert(owner: SoilTestOwner, input: SoilTestCreateDto): Promise<SoilTestDto> {
    const [row] = await this.db
      .insert(gardenSoilTests)
      .values({ ...owner, ...input })
      .returning();
    return toDto(row!);
  }

  async delete(owner: SoilTestOwner, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(gardenSoilTests)
      .where(and(ownedBy(owner), eq(gardenSoilTests.id, id)))
      .returning({ id: gardenSoilTests.id });
    return rows.length > 0;
  }

  async latestFor(owner: SoilTestOwner): Promise<SoilTestDto | null> {
    const [row] = await this.db
      .select()
      .from(gardenSoilTests)
      .where(ownedBy(owner))
      .orderBy(...latestFirst)
      .limit(1);
    return row ? toDto(row) : null;
  }

  /** The latest test of each area and of each bed in a property. */
  async latestByGarden(
    gardenId: string,
  ): Promise<{ areas: Map<string, SoilTestDto>; beds: Map<string, SoilTestDto> }> {
    const [areaRows, bedRows] = await Promise.all([
      this.db
        .select({ test: gardenSoilTests })
        .from(gardenSoilTests)
        .innerJoin(gardenAreas, eq(gardenSoilTests.areaId, gardenAreas.id))
        .where(eq(gardenAreas.gardenId, gardenId))
        .orderBy(...latestFirst),
      this.db
        .select({ test: gardenSoilTests })
        .from(gardenSoilTests)
        .innerJoin(gardenBeds, eq(gardenSoilTests.bedId, gardenBeds.id))
        .where(eq(gardenBeds.gardenId, gardenId))
        .orderBy(...latestFirst),
    ]);
    return {
      areas: latestPerKey(
        areaRows.map((r) => r.test),
        (row) => row.areaId,
      ),
      beds: latestPerKey(
        bedRows.map((r) => r.test),
        (row) => row.bedId,
      ),
    };
  }
}
