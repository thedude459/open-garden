import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { SeasonService, domainError } from '@open-garden/seasonal-plantings';
import {
  GardenMembershipRepository,
  PlantRepository,
  YearRecordRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { companionPairSchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';

@Controller('gardens/:id/season')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenSeasonController {
  private readonly seasons: SeasonService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.seasons = new SeasonService(
      new GardenMembershipRepository(bundle.db),
      new YearRecordRepository(bundle.db),
      new PlantRepository(bundle.db),
    );
  }

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.seasons.get(user.id, id);
  }

  @Post('close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.seasons.close(user.id, id);
  }

  @Post('companions')
  @HttpCode(200)
  addCompanion(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = companionPairSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid pair');
    }
    return this.seasons.addPair(user.id, id, parsed.data);
  }
}
