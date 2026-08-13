import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import {
  CatalogService,
  PlantDetailService,
} from '@open-garden/plant-catalog';
import {
  FavoriteRepository,
  PlantRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import {
  FixturePlantProvider,
  PerenualPlantProvider,
  type PlantDataProvider,
} from '@open-garden/plant-provider';
import { plantListQuerySchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';

@Controller('plants')
@UseGuards(SessionGuard)
export class PlantsController {
  private readonly catalog: CatalogService;
  private readonly details: PlantDetailService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    const plants = new PlantRepository(bundle.db);
    const favorites = new FavoriteRepository(bundle.db);
    const provider = createProvider();
    this.catalog = new CatalogService(plants, provider);
    this.details = new PlantDetailService(plants, favorites);
  }

  @Get()
  list(
    @Query('q') q?: string,
    @Query('zone') zoneRaw?: string,
    @Query('plantType') plantType?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const parsed = plantListQuerySchema.safeParse({
      q,
      zone: zoneRaw === undefined || zoneRaw === '' ? undefined : zoneRaw,
      plantType: plantType === undefined || plantType === '' ? undefined : plantType,
      page: pageRaw,
      pageSize: pageSizeRaw,
    });
    if (!parsed.success) {
      const err = new Error(parsed.error.issues[0]?.message ?? 'Invalid query') as Error & {
        code: string;
      };
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    return this.catalog.list(parsed.data);
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const plant = await this.details.getById(id, user.id);
    if (!plant) {
      const err = new Error('Plant not found') as Error & { code: string };
      err.code = 'NOT_FOUND';
      throw err;
    }
    return plant;
  }
}

export function createProvider(): PlantDataProvider {
  const kind = process.env['PLANT_PROVIDER'] ?? 'fixture';
  if (kind === 'perenual') {
    const key = process.env['PERENUAL_API_KEY'] ?? '';
    return new PerenualPlantProvider(key);
  }
  return new FixturePlantProvider();
}
