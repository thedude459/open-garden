import { Module } from '@nestjs/common';
import { PipelineRunsController } from './pipeline-runs.controller';
import { AdminGuard } from './admin.guard';

@Module({
  controllers: [PipelineRunsController],
  providers: [AdminGuard],
})
export class AdminModule {}
