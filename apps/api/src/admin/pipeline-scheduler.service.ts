import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CatalogPipelineService } from '@open-garden/catalog-pipeline';
import {
  PipelineRunRepository,
  PipelineSettingsRepository,
  PlantRepository,
  PlantSourceRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { DATABASE } from '../database/database.tokens';
import { createPipelineSources } from './pipeline-sources';

@Injectable()
export class PipelineSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PipelineSchedulerService.name);
  private readonly pipeline: CatalogPipelineService;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    const plants = new PlantRepository(bundle.db);
    const plantSources = new PlantSourceRepository(bundle.db);
    const runs = new PipelineRunRepository(bundle.db);
    const settings = new PipelineSettingsRepository(bundle.db);
    this.pipeline = new CatalogPipelineService(
      runs,
      settings,
      {
        listSnapshots: () => plants.listSnapshots(),
        listSourceLinks: () => plantSources.listAll(),
      },
      createPipelineSources(),
    );
  }

  async onModuleInit() {
    await this.pipeline.failStaleRunning();
    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const run = await this.pipeline.tryStartScheduled();
      if (run) {
        void this.pipeline.executeRun(run.id).catch((err) => this.logger.error(err));
      }
    } catch (err) {
      this.logger.error(err);
    }
  }
}
