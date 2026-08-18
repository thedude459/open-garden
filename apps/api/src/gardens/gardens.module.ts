import { Module } from '@nestjs/common';
import { GardensController } from './gardens.controller';
import { GardenMembersController } from './garden-members.controller';
import { GardenCalendarController } from './garden-calendar.controller';
import { GardenPlantingsController } from './garden-plantings.controller';
import { GardenBedsController } from './garden-beds.controller';
import { GardenLayoutController } from './garden-layout.controller';
import { GardenRemindersController } from './garden-reminders.controller';
import { GardenMembershipGuard } from './garden-membership.guard';

@Module({
  controllers: [
    GardensController,
    GardenMembersController,
    GardenCalendarController,
    GardenPlantingsController,
    GardenBedsController,
    GardenLayoutController,
    GardenRemindersController,
  ],
  providers: [GardenMembershipGuard],
})
export class GardensModule {}
