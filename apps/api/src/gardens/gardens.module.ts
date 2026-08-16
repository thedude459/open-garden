import { Module } from '@nestjs/common';
import { GardensController } from './gardens.controller';
import { GardenMembersController } from './garden-members.controller';
import { GardenCalendarController } from './garden-calendar.controller';
import { GardenPlantingsController } from './garden-plantings.controller';
import { GardenBedsController } from './garden-beds.controller';
import { GardenMembershipGuard } from './garden-membership.guard';

@Module({
  controllers: [
    GardensController,
    GardenMembersController,
    GardenCalendarController,
    GardenPlantingsController,
    GardenBedsController,
  ],
  providers: [GardenMembershipGuard],
})
export class GardensModule {}
