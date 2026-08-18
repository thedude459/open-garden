import { eq } from 'drizzle-orm';
import type { PipelineCadence } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { catalogPipelineSettings } from './schema';

export interface PipelineSettingsRow {
  cadence: PipelineCadence;
  runAtHourUtc: number;
  sourceOrder: string[];
  updatedAt: Date;
  updatedByUserId: string | null;
}

const DEFAULTS: PipelineSettingsRow = {
  cadence: 'daily',
  runAtHourUtc: 6,
  sourceOrder: ['fixture'],
  updatedAt: new Date(0),
  updatedByUserId: null,
};

export function collapseSourceOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const reversed: string[] = [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i]?.trim() ?? '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    reversed.push(id);
  }
  return reversed.reverse();
}

export class PipelineSettingsRepository {
  constructor(private readonly db: AppDatabase) {}

  async get(): Promise<PipelineSettingsRow> {
    const [row] = await this.db
      .select()
      .from(catalogPipelineSettings)
      .where(eq(catalogPipelineSettings.id, 1))
      .limit(1);
    if (!row) {
      await this.db
        .insert(catalogPipelineSettings)
        .values({
          id: 1,
          cadence: DEFAULTS.cadence,
          runAtHourUtc: DEFAULTS.runAtHourUtc,
          sourceOrder: DEFAULTS.sourceOrder,
        })
        .onConflictDoNothing();
      return { ...DEFAULTS, updatedAt: new Date() };
    }
    return {
      cadence: row.cadence as PipelineCadence,
      runAtHourUtc: row.runAtHourUtc,
      sourceOrder: row.sourceOrder ?? ['fixture'],
      updatedAt: row.updatedAt,
      updatedByUserId: row.updatedByUserId,
    };
  }

  async patch(
    input: {
      cadence?: PipelineCadence;
      runAtHourUtc?: number;
      sourceOrder?: string[];
    },
    userId: string | null,
  ): Promise<PipelineSettingsRow> {
    const current = await this.get();
    const sourceOrder =
      input.sourceOrder !== undefined ? collapseSourceOrder(input.sourceOrder) : current.sourceOrder;
    await this.db
      .update(catalogPipelineSettings)
      .set({
        cadence: input.cadence ?? current.cadence,
        runAtHourUtc: input.runAtHourUtc ?? current.runAtHourUtc,
        sourceOrder,
        updatedAt: new Date(),
        updatedByUserId: userId,
      })
      .where(eq(catalogPipelineSettings.id, 1));
    return this.get();
  }
}
