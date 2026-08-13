import { Global, Inject, Module } from '@nestjs/common';
import { AuthService } from '@open-garden/auth';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import { DATABASE } from '../database/database.tokens';
import { AuthController } from './auth.controller';
import { SessionGuard } from './session.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useFactory: (bundle: { db: AppDatabase }) => new AuthService(bundle.db),
      inject: [DATABASE],
    },
    SessionGuard,
  ],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {
  constructor(@Inject(DATABASE) _db: { db: AppDatabase }) {}
}
