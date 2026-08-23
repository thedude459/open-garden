import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { deriveIndoorReminders, domainError } from '@open-garden/care-reminders';
import { PlantingService } from '@open-garden/seasonal-plantings';
import {
  BedRepository,
  CareEventRepository,
  GardenMembershipRepository,
  PlantingRepository,
  PlantRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { asOfQuerySchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';

@Controller('gardens/:id/transplants')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenTransplantsController {
  private readonly plantings: PlantingService;
  private readonly events: CareEventRepository;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.plantings = new PlantingService(
      new GardenMembershipRepository(bundle.db),
      new PlantRepository(bundle.db),
      new PlantingRepository(bundle.db),
      new BedRepository(bundle.db),
    );
    this.events = new CareEventRepository(bundle.db);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('asOf') asOfRaw?: string,
  ) {
    const asOf =
      asOfRaw && asOfQuerySchema.safeParse({ asOf: asOfRaw }).success
        ? asOfRaw
        : new Date().toISOString().slice(0, 10);
    const { myRole, plantings } = await this.plantings.listUnplacedTransplants(user.id, id);
    const eventRows = await this.events.listForGarden(id);
    const indoorReminders = deriveIndoorReminders(
      plantings.map((p) => ({
        plantingId: p.id,
        plantId: p.plantId,
        commonName: p.commonName,
        species: p.species,
        cultivar: p.cultivar,
        plantType: p.plantType,
        status: p.status,
        plantedOn: null,
        harvestedOn: null,
        daysToMaturity: null,
        waterIntervalDays: p.waterIntervalDays ?? null,
        fertilizeIntervalDays: p.fertilizeIntervalDays ?? null,
        startMethod: p.startMethod,
        indoorStartedOn: p.indoorStartedOn,
        placed: p.placement !== null,
      })),
      eventRows,
      asOf,
    );
    return { gardenId: id, myRole, plantings, indoorReminders };
  }
}
