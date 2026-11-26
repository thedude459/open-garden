import { Controller, Get, Inject, Logger, Param, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { CatalogService, PlantDetailService } from '@open-garden/plant-catalog';
import type { CalendarService } from '@open-garden/planting-calendar';
import {
  CatalogCompanionRepository,
  CatalogPestRepository,
  FavoriteRepository,
  GardenRepository,
  PlantRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { plantListQuerySchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { domainError } from '@open-garden/shared-types';
import { DATABASE } from '../database/database.tokens';
import { openCalendarService } from '../gardens/calendar-service.factory';
import { idOf } from '../common/ids';

@Controller('plants')
@UseGuards(SessionGuard)
export class PlantsController {
  private readonly logger = new Logger(PlantsController.name);
  private readonly catalog: CatalogService;
  private readonly details: PlantDetailService;
  private readonly calendar: CalendarService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    const plants = new PlantRepository(bundle.db);
    const favorites = new FavoriteRepository(bundle.db);
    this.catalog = new CatalogService(plants);
    const gardens = new GardenRepository(bundle.db);
    this.calendar = openCalendarService(bundle.db);
    this.details = new PlantDetailService(
      plants,
      favorites,
      {
        pairs: new CatalogCompanionRepository(bundle.db),
        zonesForUser: (userId) => gardens.zonesForUser(userId),
      },
      {
        catalog: new CatalogPestRepository(bundle.db),
        placesForUser: (userId) => gardens.placesForUser(userId),
      },
    );
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('zone') zoneRaw?: string,
    @Query('plantType') plantType?: string,
    @Query('area') area?: string,
    @Query('family') family?: string,
    @Query('sowNowFor') sowNowFor?: string,
    @Query('asOf') asOf?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const parsed = plantListQuerySchema.safeParse({
      q,
      zone: blankToUndefined(zoneRaw),
      plantType: blankToUndefined(plantType),
      area: blankToUndefined(area),
      family: blankToUndefined(family),
      sowNowFor: blankToUndefined(sowNowFor),
      asOf: blankToUndefined(asOf),
      page: pageRaw,
      pageSize: pageSizeRaw,
    });
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query');
    }
    const started = Date.now();
    const { sowNowFor: gardenId, asOf: asOfDate } = parsed.data;
    const keep = gardenId
      ? await this.calendar.sowableNow(user.id, gardenId, localDate(asOfDate))
      : undefined;
    const result = await this.catalog.list(parsed.data, keep);
    this.logger.debug(`plants.list.assembly_ms=${Date.now() - started}`);
    return result;
  }

  @Get('families')
  families() {
    return this.catalog.families();
  }

  @Get(':id')
  async detail(@Param('id', idOf('Plant')) id: string, @CurrentUser() user: AuthUser) {
    const plant = await this.details.getById(id, user.id);
    if (!plant) {
      const err = new Error('Plant not found') as Error & { code: string };
      err.code = 'NOT_FOUND';
      throw err;
    }
    return plant;
  }
}

function blankToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

/** The member's local date, or the server's when the client sent none. */
function localDate(asOf: string | undefined): Date {
  if (!asOf) return new Date();
  const [year, month, day] = asOf.split('-').map(Number);
  return new Date(year!, month! - 1, day);
}
