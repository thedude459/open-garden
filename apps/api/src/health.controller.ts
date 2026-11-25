import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { domainError } from '@open-garden/shared-types';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import { DATABASE } from './database/database.tokens';

/**
 * Docker's health check. It asks the database too, so the container reports
 * unhealthy when Postgres is gone, instead of answering every request with 500s
 * while looking fine.
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly bundle: { db: AppDatabase }) {}

  @Get()
  async ok(): Promise<{ status: string }> {
    try {
      await this.bundle.db.execute(sql`select 1`);
    } catch {
      throw domainError('SERVICE_UNAVAILABLE', 'The database cannot be reached');
    }
    return { status: 'ok' };
  }
}
