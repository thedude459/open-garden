import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { createDb } from '@open-garden/plant-catalog-data';
import { DATABASE, DB_POOL } from './database.tokens';

/** Ends the pool's connections once Nest has stopped taking requests. */
@Injectable()
export class ClosePoolOnShutdown implements OnApplicationShutdown {
  private readonly logger = new Logger('DatabasePool');

  constructor(@Inject(DATABASE) private readonly bundle: { pool: { end(): Promise<void> } }) {}

  async onApplicationShutdown(signal?: string) {
    await this.bundle.pool.end();
    this.logger.log(`database.pool_closed signal=${signal ?? 'none'}`);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: () => {
        const url = process.env['DATABASE_URL'];
        if (!url) {
          throw new Error('DATABASE_URL is required');
        }
        const logger = new Logger('DatabasePool');
        const { db, pool } = createDb(url, {
          applicationName: 'open-garden-api',
          onPoolError: (error) =>
            logger.error(`Idle client error, client discarded: ${error.message}`),
        });
        return { db, pool };
      },
    },
    {
      provide: DB_POOL,
      useFactory: (bundle: { pool: unknown }) => bundle.pool,
      inject: [DATABASE],
    },
    ClosePoolOnShutdown,
  ],
  exports: [DATABASE, DB_POOL],
})
export class DatabaseModule {}
