import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '@open-garden/auth';
import { domainError } from '@open-garden/seasonal-plantings';
import { SoilTestService } from '@open-garden/seasonal-plantings';
import {
  BedRepository,
  GardenMembershipRepository,
  SoilTestRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { bedCreateSchema, bedPatchSchema, soilTestCreateSchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';
import { openPlantingService } from './planting-service.factory';

@Controller('gardens/:id/beds')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenBedsController {
  private readonly plantings: ReturnType<typeof openPlantingService>;
  private readonly soilTests: SoilTestService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.plantings = openPlantingService(bundle.db);
    this.soilTests = new SoilTestService(
      new GardenMembershipRepository(bundle.db),
      new BedRepository(bundle.db),
      new SoilTestRepository(bundle.db),
    );
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = bedCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', 'Bed name is required');
    }
    const result = await this.plantings.createBed(user.id, id, parsed.data);
    res.status(result.created ? 201 : 200);
    return result.bed;
  }

  @Patch(':bedId')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('bedId') bedId: string,
    @Body() body: unknown,
  ) {
    const parsed = bedPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', 'Bed name is required');
    }
    return this.plantings.renameBed(user.id, id, bedId, parsed.data);
  }

  @Delete(':bedId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('bedId') bedId: string) {
    return this.plantings.deleteBed(user.id, id, bedId);
  }

  @Post(':bedId/soil-tests')
  recordSoilTest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('bedId', ParseUUIDPipe) bedId: string,
    @Body() body: unknown,
  ) {
    const parsed = soilTestCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Check the soil test',
      );
    }
    return this.soilTests.record(user.id, id, bedId, parsed.data);
  }

  /** Answers with the bed's latest test once this one is gone. */
  @Delete(':bedId/soil-tests/:testId')
  removeSoilTest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('bedId', ParseUUIDPipe) bedId: string,
    @Param('testId', ParseUUIDPipe) testId: string,
  ) {
    return this.soilTests.remove(user.id, id, bedId, testId);
  }
}
