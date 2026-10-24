import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import { domainError } from '@open-garden/seasonal-plantings';
import { areaCreateSchema, trayCreateSchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';
import { openPlantingService } from './planting-service.factory';

@Controller('gardens/:id')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenAreasController {
  private readonly plantings: ReturnType<typeof openPlantingService>;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.plantings = openPlantingService(bundle.db);
  }

  @Get('areas')
  listAreas(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plantings.listAreas(user.id, id);
  }

  @Post('areas')
  createArea(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = areaCreateSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Choose a vegetable garden, orchard, or greenhouse');
    return this.plantings.createArea(user.id, id, parsed.data.kind);
  }

  @Get('trays')
  listTrays(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plantings.listTrays(user.id, id);
  }

  @Post('trays')
  createTray(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = trayCreateSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Tray name is required');
    return this.plantings.createTray(user.id, id, parsed.data.name);
  }
}
