import { Global, Module } from '@nestjs/common';
import { createDb } from '@open-garden/plant-catalog-data';
import { DATABASE, DB_POOL } from './database.tokens';

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
        const { db, pool } = createDb(url);
        return { db, pool };
      },
    },
    {
      provide: DB_POOL,
      useFactory: (bundle: { pool: unknown }) => bundle.pool,
      inject: [DATABASE],
    },
  ],
  exports: [DATABASE, DB_POOL],
})
export class DatabaseModule {}
