import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { FavoritesService } from '@open-garden/plant-favorites';
import {
  FavoriteRepository,
  PlantRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';

@Controller('favorites')
@UseGuards(SessionGuard)
export class FavoritesController {
  private readonly favorites: FavoritesService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.favorites = new FavoritesService(
      new FavoriteRepository(bundle.db),
      new PlantRepository(bundle.db),
    );
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    return this.favorites.list(
      user.id,
      pageRaw ? Number(pageRaw) : 1,
      pageSizeRaw ? Number(pageSizeRaw) : 20,
    );
  }

  @Put(':plantId')
  async add(
    @CurrentUser() user: AuthUser,
    @Param('plantId') plantId: string,
    @Body() body: { clientMutationId?: string },
  ) {
    return this.favorites.add(user.id, plantId, body?.clientMutationId);
  }

  @Delete(':plantId')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('plantId') plantId: string) {
    await this.favorites.remove(user.id, plantId);
  }
}
