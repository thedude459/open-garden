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
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '@open-garden/auth';
import { domainError } from '@open-garden/seasonal-plantings';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import {
  plantingCreateSchema,
  plantingListQuerySchema,
  plantingPatchSchema,
  plantingRepeatSchema,
} from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';
import { openPlantingService } from './planting-service.factory';

@Controller('gardens/:id/plantings')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenPlantingsController {
  private readonly plantings: ReturnType<typeof openPlantingService>;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.plantings = openPlantingService(bundle.db);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const parsed = plantingListQuerySchema.safeParse({ page: pageRaw, pageSize: pageSizeRaw });
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', 'Invalid list query');
    }
    return this.plantings.list(user.id, id, parsed.data.page, parsed.data.pageSize);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = plantingCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Plant is required');
    }
    const result = await this.plantings.create(user.id, id, parsed.data);
    res.status(result.created ? 201 : 200);
    return result.list;
  }

  @Patch(':plantingId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('plantingId') plantingId: string,
    @Body() body: unknown,
  ) {
    const parsed = plantingPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Date must be YYYY-MM-DD',
      );
    }
    return this.plantings.update(user.id, id, plantingId, parsed.data);
  }

  /** The last sowing of this crop that ripens before frost, to suggest as a series' end. */
  @Get(':plantingId/repeat')
  repeatPlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('plantingId') plantingId: string,
  ) {
    return this.plantings.repeatPlan(user.id, id, plantingId);
  }

  /** Succession planting: sow it again every N weeks until a date. */
  @Post(':plantingId/repeat')
  @HttpCode(201)
  repeat(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('plantingId') plantingId: string,
    @Body() body: unknown,
  ) {
    const parsed = plantingRepeatSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Repeat every 1 to 12 weeks until a date',
      );
    }
    return this.plantings.repeat(
      user.id,
      id,
      plantingId,
      parsed.data.everyWeeks,
      parsed.data.until,
    );
  }

  @Delete(':plantingId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('plantingId') plantingId: string,
  ) {
    return this.plantings.remove(user.id, id, plantingId);
  }
}
