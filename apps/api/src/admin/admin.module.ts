import { Module } from '@nestjs/common';
import { PipelineRunsController } from './pipeline-runs.controller';
import { PipelineSettingsController } from './pipeline-settings.controller';
import { PipelineSchedulerService } from './pipeline-scheduler.service';
import { AdminGuard } from './admin.guard';

@Module({
  controllers: [PipelineRunsController, PipelineSettingsController],
  providers: [PipelineSchedulerService, AdminGuard],
})
export class AdminModule {}
