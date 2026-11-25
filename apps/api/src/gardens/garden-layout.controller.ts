import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { domainError } from '@open-garden/garden-layout';
import type { LayoutService } from '@open-garden/garden-layout/server';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import { openLayoutService } from './layout-service.factory';
import { layoutPutSchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';
import { season } from './season-query';
import { idOf } from '../common/ids';

@Controller()
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenLayoutController {
  private readonly logger = new Logger(GardenLayoutController.name);
  private readonly layouts: LayoutService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.layouts = openLayoutService(bundle.db);
  }

  @Get('gardens/:id/layout')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('season') seasonRaw?: string,
  ) {
    const started = Date.now();
    const result = await this.layouts.get(user.id, id, season(seasonRaw));
    this.logger.log(`garden.layout.assembly_ms=${Date.now() - started}`);
    return result;
  }

  @Put('gardens/:id/layout')
  put(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query('season') seasonRaw?: string,
  ) {
    const parsed = layoutPutSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Bed size and position are required',
      );
    }
    return this.layouts.put(user.id, id, parsed.data, season(seasonRaw));
  }

  /** A walkway or other non-planting area; typed areas are under `areas/`. */
  @Delete('gardens/:id/walkways/:walkwayId')
  @HttpCode(204)
  deleteWalkway(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('walkwayId', idOf('Walkway')) walkwayId: string,
  ) {
    return this.layouts.deleteArea(user.id, id, walkwayId);
  }
}
