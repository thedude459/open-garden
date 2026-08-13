import { and, asc, count, eq } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { favorites, plants } from './schema';

export class FavoriteRepository {
  constructor(private readonly db: AppDatabase) {}

  async listForUser(userId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select({
        favoriteId: favorites.id,
        createdAt: favorites.createdAt,
        plant: plants,
      })
      .from(favorites)
      .innerJoin(plants, eq(favorites.plantId, plants.id))
      .where(eq(favorites.userId, userId))
      .orderBy(asc(plants.commonName))
      .limit(pageSize)
      .offset(offset);

    const [total] = await this.db
      .select({ value: count() })
      .from(favorites)
      .where(eq(favorites.userId, userId));

    return { items: rows, totalCount: total?.value ?? 0, page, pageSize };
  }

  async add(userId: string, plantId: string, clientMutationId?: string) {
    const existing = await this.db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.plantId, plantId)))
      .limit(1);
    if (existing[0]) {
      if (clientMutationId) {
        const [row] = await this.db
          .update(favorites)
          .set({ clientMutationId })
          .where(eq(favorites.id, existing[0].id))
          .returning();
        return row;
      }
      return existing[0];
    }
    const [row] = await this.db
      .insert(favorites)
      .values({
        userId,
        plantId,
        clientMutationId: clientMutationId ?? null,
      })
      .returning();
    return row;
  }

  async remove(userId: string, plantId: string) {
    await this.db
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.plantId, plantId)));
  }

  async isFavorite(userId: string, plantId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.plantId, plantId)))
      .limit(1);
    return Boolean(row);
  }
}
