import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
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
import {
  openPlantingService,
  openSoilTestService,
  parseSoilTest,
} from './planting-service.factory';

@Controller('gardens/:id')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenAreasController {
  private readonly plantings: ReturnType<typeof openPlantingService>;
  private readonly soilTests: ReturnType<typeof openSoilTestService>;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.plantings = openPlantingService(bundle.db);
    this.soilTests = openSoilTestService(bundle.db);
  }

  @Get('areas')
  listAreas(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plantings.listAreas(user.id, id);
  }

  @Post('areas')
  createArea(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = areaCreateSchema.safeParse(body);
    if (!parsed.success)
      throw domainError(
        'VALIDATION_ERROR',
        'Choose a vegetable garden, orchard, bramble patch, or greenhouse',
      );
    return this.plantings.createArea(user.id, id, parsed.data.kind);
  }

  @Patch('areas/:areaId')
  renameArea(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() body: unknown,
  ) {
    const parsed = areaPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Area name is required',
      );
    }
    return this.plantings.renameArea(user.id, id, areaId, parsed.data.name);
  }

  /** Only an empty area can go: one that holds beds or trays is refused (409). */
  @Delete('areas/:areaId')
  @HttpCode(204)
  deleteArea(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ) {
    return this.plantings.deleteArea(user.id, id, areaId);
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

  /** One sample of the area's ground; a bed whose soil differs takes its own (ADR 0033). */
  @Post('areas/:areaId/soil-tests')
  recordSoilTest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() body: unknown,
  ) {
    return this.soilTests.record(user.id, id, { areaId }, parseSoilTest(body));
  }

  /** Answers with the area's latest test once this one is gone. */
  @Delete('areas/:areaId/soil-tests/:testId')
  removeSoilTest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Param('testId', ParseUUIDPipe) testId: string,
  ) {
    return this.soilTests.remove(user.id, id, { areaId }, testId);
  }
}
