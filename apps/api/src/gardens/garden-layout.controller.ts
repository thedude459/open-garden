import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Put, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { LayoutService, domainError } from '@open-garden/garden-layout';
import {
  AreaRepository,
  BedRepository,
  GardenMembershipRepository,
  PlantingRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { layoutPutSchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';

@Controller()
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenLayoutController {
  private readonly layouts: LayoutService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.layouts = new LayoutService(
      new GardenMembershipRepository(bundle.db),
      new PlantingRepository(bundle.db),
      new BedRepository(bundle.db),
      new AreaRepository(bundle.db),
    );
  }

  @Get('gardens/:id/layout')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.layouts.get(user.id, id);
  }

  @Put('gardens/:id/layout')
  put(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = layoutPutSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Bed size and position are required',
      );
    }
    return this.layouts.put(user.id, id, parsed.data);
  }

  @Delete('gardens/:id/areas/:areaId')
  @HttpCode(204)
  deleteArea(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId') areaId: string,
  ) {
    return this.layouts.deleteArea(user.id, id, areaId);
  }
}
