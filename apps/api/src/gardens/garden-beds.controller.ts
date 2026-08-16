import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '@open-garden/auth';
import { PlantingService, domainError } from '@open-garden/seasonal-plantings';
import {
  BedRepository,
  GardenMembershipRepository,
  PlantingRepository,
  PlantRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { bedCreateSchema, bedPatchSchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';

@Controller('gardens/:id/beds')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenBedsController {
  private readonly plantings: PlantingService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.plantings = new PlantingService(
      new GardenMembershipRepository(bundle.db),
      new PlantRepository(bundle.db),
      new PlantingRepository(bundle.db),
      new BedRepository(bundle.db),
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
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('bedId') bedId: string,
  ) {
    return this.plantings.deleteBed(user.id, id, bedId);
  }
}
