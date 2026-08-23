import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PlantsModule } from './plants/plants.module';
import { FavoritesModule } from './favorites/favorites.module';
import { GardensModule } from './gardens/gardens.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [DatabaseModule, AuthModule, PlantsModule, FavoritesModule, GardensModule, AdminModule],
})
export class AppModule {}
