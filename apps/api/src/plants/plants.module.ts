import { Module } from '@nestjs/common';
import { PlantsController } from './plants.controller';
import { PlantsSyncController } from './plants-sync.controller';

@Module({
  controllers: [PlantsController, PlantsSyncController],
})
export class PlantsModule {}
