import { and, desc, eq } from 'drizzle-orm';
import type { NutrientLevel, SoilTestCreateDto, SoilTestDto } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { gardenBedSoilTests, gardenBeds } from './schema';

type Row = typeof gardenBedSoilTests.$inferSelect;

function level(value: string | null): NutrientLevel | null {
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

function toDto(row: Row): SoilTestDto {
  return {
    id: row.id,
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

/** Soil tests of beds (ADR 0033). Callers check the bed belongs to the property. */
export class SoilTestRepository {
  constructor(private readonly db: AppDatabase) {}

  async insert(bedId: string, input: SoilTestCreateDto): Promise<SoilTestDto> {
    const [row] = await this.db
      .insert(gardenBedSoilTests)
      .values({ bedId, ...input })
      .returning();
    return toDto(row!);
  }

  async delete(bedId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(gardenBedSoilTests)
      .where(and(eq(gardenBedSoilTests.bedId, bedId), eq(gardenBedSoilTests.id, id)))
      .returning({ id: gardenBedSoilTests.id });
    return rows.length > 0;
  }

  async latestForBed(bedId: string): Promise<SoilTestDto | null> {
    const [row] = await this.db
      .select()
      .from(gardenBedSoilTests)
      .where(eq(gardenBedSoilTests.bedId, bedId))
      .orderBy(desc(gardenBedSoilTests.testedOn), desc(gardenBedSoilTests.createdAt))
      .limit(1);
    return row ? toDto(row) : null;
  }

  /** Each bed's latest test in a property: the latest test date, then the latest entered. */
  async latestByGarden(gardenId: string): Promise<Map<string, SoilTestDto>> {
    const rows = await this.db
      .select({ test: gardenBedSoilTests })
      .from(gardenBedSoilTests)
      .innerJoin(gardenBeds, eq(gardenBedSoilTests.bedId, gardenBeds.id))
      .where(eq(gardenBeds.gardenId, gardenId))
      .orderBy(desc(gardenBedSoilTests.testedOn), desc(gardenBedSoilTests.createdAt));
    const latest = new Map<string, SoilTestDto>();
    for (const { test } of rows) {
      if (!latest.has(test.bedId)) latest.set(test.bedId, toDto(test));
    }
    return latest;
  }
}
