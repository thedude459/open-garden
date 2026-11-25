import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import { domainError } from '@open-garden/seasonal-plantings';
import { areaCreateSchema, areaPatchSchema, trayCreateSchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';
import { openBedService, openSoilTestService, parseSoilTest } from './planting-service.factory';
import { idOf } from '../common/ids';

@Controller('gardens/:id')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenAreasController {
  private readonly beds: ReturnType<typeof openBedService>;
  private readonly soilTests: ReturnType<typeof openSoilTestService>;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.beds = openBedService(bundle.db);
    this.soilTests = openSoilTestService(bundle.db);
  }

  @Get('areas')
  listAreas(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.beds.listAreas(user.id, id);
  }

  @Post('areas')
  createArea(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = areaCreateSchema.safeParse(body);
    if (!parsed.success)
      throw domainError(
        'VALIDATION_ERROR',
        'Choose a vegetable garden, fruit garden, or greenhouse',
      );
    return this.beds.createArea(user.id, id, parsed.data.kind);
  }

  @Patch('areas/:areaId')
  renameArea(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId', idOf('Area')) areaId: string,
    @Body() body: unknown,
  ) {
    const parsed = areaPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Area name is required',
      );
    }
    return this.beds.renameArea(user.id, id, areaId, parsed.data.name);
  }

  /** Only an empty area can go: one that holds beds or trays is refused (409). */
  @Delete('areas/:areaId')
  @HttpCode(204)
  deleteArea(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId', idOf('Area')) areaId: string,
  ) {
    return this.beds.deleteArea(user.id, id, areaId);
  }

  @Get('trays')
  listTrays(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.beds.listTrays(user.id, id);
  }

  @Post('trays')
  createTray(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = trayCreateSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Tray name is required');
    return this.beds.createTray(user.id, id, parsed.data.name);
  }

  /** One sample of the area's ground; a bed whose soil differs takes its own (ADR 0033). */
  @Post('areas/:areaId/soil-tests')
  recordSoilTest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId', idOf('Area')) areaId: string,
    @Body() body: unknown,
  ) {
    return this.soilTests.record(user.id, id, { areaId }, parseSoilTest(body));
  }

  /** Answers with the area's latest test once this one is gone. */
  @Delete('areas/:areaId/soil-tests/:testId')
  removeSoilTest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId', idOf('Area')) areaId: string,
    @Param('testId', idOf('Soil test')) testId: string,
  ) {
    return this.soilTests.remove(user.id, id, { areaId }, testId);
  }
}
