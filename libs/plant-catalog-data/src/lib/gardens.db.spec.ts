// Repository integration tests against a real PostgreSQL (PGlite): who can see
// which property, sharing, ownership transfer, and deletion.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BedRepository } from './bed-repository';
import { GardenMembershipRepository } from './garden-membership-repository';
import { GardenRepository } from './garden-repository';
import { createTestDb, gardenInput, insertUser, type TestDb } from './test-db';

let t: TestDb;
let gardens: GardenRepository;
let members: GardenMembershipRepository;
let beds: BedRepository;

beforeAll(async () => {
  t = await createTestDb();
  gardens = new GardenRepository(t.db);
  members = new GardenMembershipRepository(t.db);
  beds = new BedRepository(t.db);
});
afterAll(() => t.close());

describe('GardenRepository and GardenMembershipRepository', () => {
  it('creating a property makes its creator the owner', async () => {
    const owner = await insertUser(t.db);
    const garden = await gardens.createOwned(gardenInput(owner.id, 'Backyard'));
    expect(garden.ownerId).toBe(owner.id);
    expect((await members.get(garden.id, owner.id))?.role).toBe('owner');
    expect(await gardens.getById(garden.id)).toMatchObject({ name: 'Backyard' });
  });

  it('lists only properties the user belongs to, with their role, sorted and paged', async () => {
    const alice = await insertUser(t.db);
    const bob = await insertUser(t.db);
    const a1 = await gardens.createOwned(gardenInput(alice.id, 'B plot'));
    await gardens.createOwned(gardenInput(alice.id, 'A plot'));
    const bobs = await gardens.createOwned(gardenInput(bob.id, 'Bob only'));
    await members.insert(a1.id, bob.id, 'viewer');

    const aliceList = await gardens.listForUser(alice.id, 1, 20);
    expect(aliceList.items.map((g) => g.name)).toEqual(['A plot', 'B plot']);
    expect(aliceList.items.every((g) => g.myRole === 'owner')).toBe(true);
    expect(aliceList.totalCount).toBe(2);

    const bobList = await gardens.listForUser(bob.id, 1, 20);
    expect(bobList.items.map((g) => [g.name, g.myRole])).toEqual([
      ['B plot', 'viewer'],
      ['Bob only', 'owner'],
    ]);
    expect(bobList.items.some((g) => g.id === bobs.id)).toBe(true);

    const page2 = await gardens.listForUser(alice.id, 2, 1);
    expect(page2.items.map((g) => g.name)).toEqual(['B plot']);
    expect(page2.totalCount).toBe(2);
  });

  it('a stranger sees nothing and has no membership', async () => {
    const owner = await insertUser(t.db);
    const stranger = await insertUser(t.db);
    const garden = await gardens.createOwned(gardenInput(owner.id));
    expect((await gardens.listForUser(stranger.id, 1, 20)).items).toEqual([]);
    expect(await members.get(garden.id, stranger.id)).toBeNull();
  });

  it('finds an owner’s property by normalized name, optionally excluding one', async () => {
    const owner = await insertUser(t.db);
    const garden = await gardens.createOwned(gardenInput(owner.id, 'Front Yard'));
    expect((await gardens.findOwnedByNormalizedName(owner.id, 'front yard'))?.id).toBe(garden.id);
    expect(await gardens.findOwnedByNormalizedName(owner.id, 'front yard', garden.id)).toBeNull();
    const other = await insertUser(t.db);
    expect(await gardens.findOwnedByNormalizedName(other.id, 'front yard')).toBeNull();
  });

  it('the database rejects a second property with the same name for one owner', async () => {
    const owner = await insertUser(t.db);
    await gardens.createOwned(gardenInput(owner.id, 'Dup'));
    await expect(gardens.createOwned(gardenInput(owner.id, 'Dup'))).rejects.toThrow();
  });

  it('counts beds and placed plantings per property', async () => {
    const owner = await insertUser(t.db);
    const g1 = await gardens.createOwned(gardenInput(owner.id));
    const g2 = await gardens.createOwned(gardenInput(owner.id));
    await beds.insert({
      gardenId: g1.id,
      name: 'One',
      nameNormalized: 'one',
      originXInches: 0,
      originYInches: 0,
      lengthInches: 96,
      widthInches: 48,
    });
    const counts = await gardens.countsForGardenIds([g1.id, g2.id]);
    expect(counts.get(g1.id)).toEqual({ bedCount: 1, placementCount: 0 });
    expect(counts.get(g2.id)).toEqual({ bedCount: 0, placementCount: 0 });
    expect((await gardens.countsForGardenIds([])).size).toBe(0);
  });

  it('transfers ownership: old owner becomes a collaborator', async () => {
    const owner = await insertUser(t.db);
    const helper = await insertUser(t.db);
    const garden = await gardens.createOwned(gardenInput(owner.id));
    await members.insert(garden.id, helper.id, 'collaborator');
    const moved = await gardens.transferOwner(garden.id, owner.id, helper.id);
    expect(moved?.ownerId).toBe(helper.id);
    expect((await members.get(garden.id, helper.id))?.role).toBe('owner');
    expect((await members.get(garden.id, owner.id))?.role).toBe('collaborator');
  });

  it('allows only one owner per property', async () => {
    const owner = await insertUser(t.db);
    const other = await insertUser(t.db);
    const garden = await gardens.createOwned(gardenInput(owner.id));
    await expect(members.insert(garden.id, other.id, 'owner')).rejects.toThrow();
  });

  it('updates fields and deleting a property removes its memberships and beds', async () => {
    const owner = await insertUser(t.db);
    const helper = await insertUser(t.db);
    const garden = await gardens.createOwned(gardenInput(owner.id));
    await members.insert(garden.id, helper.id, 'viewer');
    await beds.insert({
      gardenId: garden.id,
      name: 'Gone',
      nameNormalized: 'gone',
      originXInches: 0,
      originYInches: 0,
      lengthInches: 10,
      widthInches: 10,
    });
    expect((await gardens.update(garden.id, { notes: 'sunny', hardinessZone: 6 }))?.notes).toBe(
      'sunny',
    );
    await gardens.hardDelete(garden.id);
    expect(await gardens.getById(garden.id)).toBeNull();
    expect(await members.get(garden.id, helper.id)).toBeNull();
    expect(await beds.listByGarden(garden.id)).toEqual([]);
    expect(await gardens.update(garden.id, { notes: 'x' })).toBeNull();
  });

  it('manages members: list, change role, remove, and look up users by email', async () => {
    const owner = await insertUser(t.db, 'owner-members@example.com');
    const friend = await insertUser(t.db, 'friend-members@example.com');
    const garden = await gardens.createOwned(gardenInput(owner.id));
    await members.insert(garden.id, friend.id, 'viewer');
    expect((await members.listMembers(garden.id)).map((m) => [m.email, m.role])).toEqual([
      ['friend-members@example.com', 'viewer'],
      ['owner-members@example.com', 'owner'],
    ]);
    expect((await members.updateRole(garden.id, friend.id, 'collaborator'))?.role).toBe(
      'collaborator',
    );
    await members.delete(garden.id, friend.id);
    expect(await members.get(garden.id, friend.id)).toBeNull();
    expect(await members.updateRole(garden.id, friend.id, 'viewer')).toBeNull();
    expect((await members.findUserByEmail('  Friend-Members@Example.com '))?.id).toBe(friend.id);
    expect(await members.findUserByEmail('nobody@example.com')).toBeNull();
  });
});
