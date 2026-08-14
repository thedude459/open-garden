import { randomUUID } from 'node:crypto';
import type { GardenRole } from '@open-garden/shared-types';
import type { GardenInsert, GardenUpdate } from '@open-garden/plant-catalog-data';
import { GardenService } from './garden-service';
import { MembershipService } from './membership-service';

interface GardenRow extends GardenInsert {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MembershipRow {
  gardenId: string;
  userId: string;
  role: GardenRole;
}

interface Account {
  id: string;
  email: string;
  displayName: string | null;
}

export function createGardenMemory() {
  const ownerId = 'owner-1';
  const friendId = 'friend-1';
  const strangerId = 'stranger-1';
  const gardens = new Map<string, GardenRow>();
  const memberships = new Map<string, MembershipRow>();
  const accounts: Account[] = [
    { id: ownerId, email: 'gardener@example.com', displayName: 'Gardener' },
    { id: friendId, email: 'friend@example.com', displayName: 'Friend' },
    { id: strangerId, email: 'stranger@example.com', displayName: 'Stranger' },
  ];

  const gardenRepo = {
    async createOwned(input: GardenInsert) {
      const row: GardenRow = {
        ...input,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      gardens.set(row.id, row);
      memberships.set(`${row.id}:${input.ownerId}`, {
        gardenId: row.id,
        userId: input.ownerId,
        role: 'owner',
      });
      return row;
    },
    async getById(id: string) {
      return gardens.get(id) ?? null;
    },
    async findOwnedByNormalizedName(ownerId: string, nameNormalized: string, excludeId?: string) {
      return (
        [...gardens.values()].find(
          (g) =>
            g.ownerId === ownerId &&
            g.nameNormalized === nameNormalized &&
            g.id !== excludeId,
        ) ?? null
      );
    },
    async listForUser(userId: string, page: number, pageSize: number) {
      const items = [...memberships.values()]
        .filter((m) => m.userId === userId)
        .map((m) => {
          const g = gardens.get(m.gardenId);
          if (!g) return null;
          return { ...g, myRole: m.role };
        })
        .filter((g): g is GardenRow & { myRole: GardenRole } => g !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        totalCount: items.length,
        page,
        pageSize,
      };
    },
    async update(id: string, patch: GardenUpdate) {
      const current = gardens.get(id);
      if (!current) return null;
      const next = { ...current, ...patch, updatedAt: new Date() };
      gardens.set(id, next);
      return next;
    },
    async hardDelete(id: string) {
      gardens.delete(id);
      for (const key of [...memberships.keys()]) {
        if (key.startsWith(`${id}:`)) memberships.delete(key);
      }
    },
  };

  const membershipRepo = {
    async get(gardenId: string, userId: string) {
      return memberships.get(`${gardenId}:${userId}`) ?? null;
    },
    async insert(gardenId: string, userId: string, role: GardenRole) {
      const row = { gardenId, userId, role };
      memberships.set(`${gardenId}:${userId}`, row);
      return row;
    },
    async listMembers(gardenId: string) {
      return [...memberships.values()]
        .filter((m) => m.gardenId === gardenId)
        .map((m) => {
          const account = accounts.find((a) => a.id === m.userId);
          return {
            userId: m.userId,
            email: account?.email ?? '',
            displayName: account?.displayName ?? null,
            role: m.role,
          };
        });
    },
    async updateRole(gardenId: string, userId: string, role: GardenRole) {
      const row = memberships.get(`${gardenId}:${userId}`);
      if (!row) return null;
      const next = { ...row, role };
      memberships.set(`${gardenId}:${userId}`, next);
      return next;
    },
    async delete(gardenId: string, userId: string) {
      memberships.delete(`${gardenId}:${userId}`);
    },
    async findUserByEmail(email: string) {
      return accounts.find((a) => a.email === email.trim().toLowerCase()) ?? null;
    },
  };

  const service = new GardenService(gardenRepo as never, membershipRepo as never);
  const membershipService = new MembershipService(gardenRepo as never, membershipRepo as never);
  return {
    service,
    membershipService,
    memberships: membershipRepo,
    ownerId,
    friendId,
    strangerId,
  };
}
