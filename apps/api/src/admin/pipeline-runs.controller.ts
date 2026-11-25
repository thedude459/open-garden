import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogPipelineService, PIPELINE_ERRORS } from '@open-garden/catalog-pipeline';
import { PipelineRunRepository, type AppDatabase } from '@open-garden/plant-catalog-data';
import { pipelineRunListQuerySchema } from '@open-garden/shared-types';
import type { AuthUser } from '@open-garden/auth';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { securityEvent } from '../common/security-log';
import { domainError } from '@open-garden/shared-types';
import { DATABASE } from '../database/database.tokens';
import { AdminGuard } from './admin.guard';
import { openCatalogPipeline } from './catalog-pipeline.factory';
import { idOf } from '../common/ids';

@Controller('admin/pipeline/runs')
@UseGuards(SessionGuard, AdminGuard)
export class PipelineRunsController {
  private readonly logger = new Logger(PipelineRunsController.name);
  private readonly pipeline: CatalogPipelineService;
  private readonly runs: PipelineRunRepository;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    ({ pipeline: this.pipeline, runs: this.runs } = openCatalogPipeline(bundle.db));
  }

  @Post()
  @HttpCode(202)
  async start(@CurrentUser() user: AuthUser) {
    const run = await this.pipeline.start('operator');
    securityEvent('catalog_run_started', { user: user.id, run: run.id });
    void this.pipeline.executeRun(run.id).catch((err: unknown) => {
      this.logger.error(
        `catalog_run.failed run=${run.id} ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    });
    return { ...run, sources: [] };
  }

  @Get()
  async list(@Query('page') pageRaw?: string, @Query('pageSize') pageSizeRaw?: string) {
    const parsed = pipelineRunListQuerySchema.safeParse({ page: pageRaw, pageSize: pageSizeRaw });
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query');
    }
    return this.runs.list(parsed.data.page, parsed.data.pageSize);
  }

  @Get(':id')
  async detail(@Param('id', idOf('Pipeline run')) id: string) {
    const detail = await this.runs.getDetail(id);
    if (!detail) throw PIPELINE_ERRORS.runNotFound();
    return detail;
  }
}
