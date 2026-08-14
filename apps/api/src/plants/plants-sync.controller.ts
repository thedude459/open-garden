import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { CatalogSyncService } from '@open-garden/plant-catalog';
import { PlantRepository, type AppDatabase } from '@open-garden/plant-catalog-data';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { createProvider } from './plants.controller';

@Controller('admin/plants')
@UseGuards(SessionGuard)
export class PlantsSyncController {
  constructor(@Inject(DATABASE) private readonly bundle: { db: AppDatabase }) {}

  @Post('sync')
  async sync(
    @CurrentUser() user: AuthUser,
    @Body() body: { provider?: string; limit?: number },
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Admin role required' },
      });
    }
    if (body.provider) {
      process.env['PLANT_PROVIDER'] = body.provider;
    }
    const provider = createProvider();
    const plants = new PlantRepository(this.bundle.db);
    const sync = new CatalogSyncService(this.bundle.db, plants, provider);
    const result = await sync.runOperatorSync(body.limit ?? 500);
    return { syncRunId: result.syncRunId, status: 'succeeded', upserted: result.upserted };
  }
}
