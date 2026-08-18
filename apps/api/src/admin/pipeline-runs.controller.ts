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
import {
  PipelineRunRepository,
  PipelineSettingsRepository,
  PlantRepository,
  PlantSourceRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { pipelineRunListQuerySchema } from '@open-garden/shared-types';
import { SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { AdminGuard } from './admin.guard';
import { createPipelineSources } from './pipeline-sources';

@Controller('admin/pipeline/runs')
@UseGuards(SessionGuard, AdminGuard)
export class PipelineRunsController {
  private readonly logger = new Logger(PipelineRunsController.name);
  private readonly pipeline: CatalogPipelineService;
  private readonly runs: PipelineRunRepository;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    const plants = new PlantRepository(bundle.db);
    const plantSources = new PlantSourceRepository(bundle.db);
    this.runs = new PipelineRunRepository(bundle.db);
    const settings = new PipelineSettingsRepository(bundle.db);
    this.pipeline = new CatalogPipelineService(
      this.runs,
      settings,
      {
        listSnapshots: () => plants.listSnapshots(),
        listSourceLinks: () => plantSources.listAll(),
      },
      createPipelineSources(),
    );
  }

  @Post()
  @HttpCode(202)
  async start() {
    const run = await this.pipeline.start('operator');
    void this.pipeline.executeRun(run.id).catch((err) => {
      this.logger.error(err);
    });
    return { ...run, sources: [] };
  }

  @Get()
  async list(@Query('page') pageRaw?: string, @Query('pageSize') pageSizeRaw?: string) {
    const parsed = pipelineRunListQuerySchema.safeParse({ page: pageRaw, pageSize: pageSizeRaw });
    if (!parsed.success) {
      const err = new Error(parsed.error.issues[0]?.message ?? 'Invalid query') as Error & {
        code: string;
      };
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    return this.runs.list(parsed.data.page, parsed.data.pageSize);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const detail = await this.runs.getDetail(id);
    if (!detail) throw PIPELINE_ERRORS.runNotFound();
    return detail;
  }
}
