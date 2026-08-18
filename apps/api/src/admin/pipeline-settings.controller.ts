import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { PIPELINE_ERRORS } from '@open-garden/catalog-pipeline';
import {
  PipelineSettingsRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { pipelineSettingsPatchSchema, type PipelineSettingsDto } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { AdminGuard } from './admin.guard';
import { createPipelineSources } from './pipeline-sources';

@Controller('admin/pipeline/settings')
@UseGuards(SessionGuard, AdminGuard)
export class PipelineSettingsController {
  private readonly settings: PipelineSettingsRepository;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.settings = new PipelineSettingsRepository(bundle.db);
  }

  @Get()
  async get(): Promise<PipelineSettingsDto> {
    const row = await this.settings.get();
    return toDto(row);
  }

  @Patch()
  async patch(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ): Promise<PipelineSettingsDto> {
    const parsed = pipelineSettingsPatchSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw PIPELINE_ERRORS.invalidSettings();
    }
    const row = await this.settings.patch(parsed.data, user.id);
    return toDto(row);
  }
}

function toDto(row: {
  cadence: PipelineSettingsDto['cadence'];
  runAtHourUtc: number;
  sourceOrder: string[];
}): PipelineSettingsDto {
  return {
    cadence: row.cadence,
    runAtHourUtc: row.runAtHourUtc,
    sourceOrder: row.sourceOrder,
    registeredSources: createPipelineSources().map((source) => source.id),
  };
}
