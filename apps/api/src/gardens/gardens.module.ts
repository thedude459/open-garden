import { Module } from '@nestjs/common';
import { GardensController } from './gardens.controller';
import { GardenMembersController } from './garden-members.controller';
import { GardenCalendarController } from './garden-calendar.controller';
import { GardenMembershipGuard } from './garden-membership.guard';

@Module({
  controllers: [GardensController, GardenMembersController, GardenCalendarController],
  providers: [GardenMembershipGuard],
})
export class GardensModule {}
