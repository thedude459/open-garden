import { and, asc, eq } from 'drizzle-orm';
import type { GardenRole } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { gardenMemberships, users } from './schema';

export class GardenMembershipRepository {
  constructor(private readonly db: AppDatabase) {}

  async get(gardenId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(gardenMemberships)
      .where(and(eq(gardenMemberships.gardenId, gardenId), eq(gardenMemberships.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  async insert(gardenId: string, userId: string, role: Exclude<GardenRole, 'owner'> | 'owner') {
    const [row] = await this.db
      .insert(gardenMemberships)
      .values({ gardenId, userId, role })
      .returning();
    return row;
  }

  async listMembers(gardenId: string) {
    return this.db
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        role: gardenMemberships.role,
      })
      .from(gardenMemberships)
      .innerJoin(users, eq(gardenMemberships.userId, users.id))
      .where(eq(gardenMemberships.gardenId, gardenId))
      .orderBy(asc(users.email));
  }

  async updateRole(gardenId: string, userId: string, role: GardenRole) {
    const [row] = await this.db
      .update(gardenMemberships)
      .set({ role })
      .where(and(eq(gardenMemberships.gardenId, gardenId), eq(gardenMemberships.userId, userId)))
      .returning();
    return row ?? null;
  }

  async delete(gardenId: string, userId: string) {
    await this.db
      .delete(gardenMemberships)
      .where(and(eq(gardenMemberships.gardenId, gardenId), eq(gardenMemberships.userId, userId)));
  }

  async findUserByEmail(email: string) {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return row ?? null;
  }
}
