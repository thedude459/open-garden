import { describe, expect, it, vi } from 'vitest';
import { FixtureClimateLookup, MAIN_STREET_PLACES, WASHINGTON_PLACE } from '@open-garden/garden-place';
import { createGardenMemory } from './test-memory';

describe('GardenService', () => {
  it('rejects blank or whitespace-only names', async () => {
    const { service, ownerId } = createGardenMemory();
    await expect(service.create(ownerId, { name: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects names longer than 120 characters', async () => {
    const { service, ownerId } = createGardenMemory();
    await expect(service.create(ownerId, { name: 'x'.repeat(121) })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('stores size on half-foot steps, defaulting to 20 by 10 ft', async () => {
    const { service, ownerId } = createGardenMemory();
    const named = await service.create(ownerId, { name: 'Plot', lengthInches: 100, widthInches: 50 });
    expect(named.lengthInches).toBe(102);
    expect(named.widthInches).toBe(48);
    const plain = await service.create(ownerId, { name: 'Plain' });
    expect(plain.lengthInches).toBe(240);
    expect(plain.widthInches).toBe(120);
  });

  it('creates an owned garden and lists it', async () => {
    const { service, ownerId } = createGardenMemory();
    const created = await service.create(ownerId, { name: 'Backyard', notes: 'South fence' });
    expect(created.myRole).toBe('owner');
    expect(created.members).toHaveLength(1);
    const page = await service.list(ownerId);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.name).toBe('Backyard');
  });

  it('enforces owner-scoped case-insensitive uniqueness', async () => {
    const { service, ownerId } = createGardenMemory();
    await service.create(ownerId, { name: 'Backyard' });
    await expect(service.create(ownerId, { name: ' backyard ' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('hides gardens from non-members', async () => {
    const { service, ownerId, strangerId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard' });
    const page = await service.list(strangerId);
    expect(page.totalCount).toBe(0);
    await expect(service.get(strangerId, garden.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps the last successful patch (last-write-wins)', async () => {
    const { service, ownerId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard', notes: 'a' });
    await service.patch(ownerId, garden.id, { notes: 'first' });
    const second = await service.patch(ownerId, garden.id, { notes: 'second' });
    expect(second.notes).toBe('second');
    const loaded = await service.get(ownerId, garden.id);
    expect(loaded.notes).toBe('second');
  });

  it('hard-deletes a garden so the owner can reuse the name', async () => {
    const { service, ownerId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Front yard' });
    await service.remove(ownerId, garden.id);
    await expect(service.get(ownerId, garden.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const again = await service.create(ownerId, { name: 'Front yard' });
    expect(again.name).toBe('Front yard');
  });

  it('maps bed and placement counts and calls countsForGardenIds once per list', async () => {
    const mem = createGardenMemory();
    const spy = vi.spyOn(mem.gardens, 'countsForGardenIds');
    const empty = await mem.service.create(mem.ownerId, { name: 'Empty plot' });
    spy.mockClear();
    const page = await mem.service.list(mem.ownerId);
    expect(page.items[0]?.bedCount).toBe(0);
    expect(page.items[0]?.placementCount).toBe(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toEqual([empty.id]);

    await mem.memberships.insert(empty.id, mem.friendId, 'viewer');
    const viewerPage = await mem.service.list(mem.friendId);
    expect(viewerPage.items).toHaveLength(1);
    expect(viewerPage.items[0]?.bedCount).toBe(0);
    expect(viewerPage.items[0]?.placementCount).toBe(0);

    const detail = await mem.service.get(mem.ownerId, empty.id);
    expect(detail.bedCount).toBe(0);
    expect(detail.placementCount).toBe(0);
  });

  it('uses one countsForGardenIds call for 20 gardens and for 1 garden', async () => {
    const many = createGardenMemory();
    const manySpy = vi.spyOn(many.gardens, 'countsForGardenIds');
    for (let i = 0; i < 20; i++) {
      await many.service.create(many.ownerId, { name: `Plot ${String(i).padStart(2, '0')}` });
    }
    manySpy.mockClear();
    await many.service.list(many.ownerId, 1, 20);
    expect(manySpy).toHaveBeenCalledTimes(1);
    expect(manySpy.mock.calls[0]?.[0]).toHaveLength(20);

    const one = createGardenMemory();
    const oneSpy = vi.spyOn(one.gardens, 'countsForGardenIds');
    await one.service.create(one.ownerId, { name: 'Solo' });
    oneSpy.mockClear();
    await one.service.list(one.ownerId);
    expect(oneSpy).toHaveBeenCalledTimes(1);
    expect(manySpy.mock.calls.length).toBe(oneSpy.mock.calls.length);
  });

  it('rejects collaborator rename that collides with the owner’s other garden', async () => {
    const { service, ownerId, friendId, memberships } = createGardenMemory();
    const backyard = await service.create(ownerId, { name: 'Backyard' });
    await service.create(ownerId, { name: 'Front yard' });
    await memberships.insert(backyard.id, friendId, 'collaborator');
    await expect(
      service.patch(friendId, backyard.id, { name: 'Front yard' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects reversed frost dates on create', async () => {
    const { service, ownerId } = createGardenMemory();
    await expect(
      service.create(ownerId, {
        name: 'Frosty',
        lastFrost: { month: 10, day: 20 },
        firstFrost: { month: 4, day: 15 },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('requires a confirmed place, stores it, and still loads a garden with no address', async () => {
    const mem = createGardenMemory();
    await expect(mem.service.create(mem.ownerId, { name: 'Plot', place: undefined })).rejects.toThrow(
      'A garden address is required',
    );
    await expect(
      mem.service.create(mem.ownerId, {
        name: 'Long',
        place: { ...WASHINGTON_PLACE, formattedAddress: 'x'.repeat(301) },
      }),
    ).rejects.toThrow('A confirmed garden address is required');

    const created = await mem.service.create(mem.ownerId, { name: 'Mapped', place: WASHINGTON_PLACE });
    expect(created.place).toMatchObject({
      formattedAddress: WASHINGTON_PLACE.formattedAddress,
      latitude: WASHINGTON_PLACE.latitude,
      longitude: WASHINGTON_PLACE.longitude,
      placeId: WASHINGTON_PLACE.placeId,
      postalCode: null,
      countryCode: null,
    });
    expect(created.seasonNotice).toBeNull();

    const replaced = await mem.service.patch(mem.ownerId, created.id, { place: MAIN_STREET_PLACES[0] });
    expect(replaced.place?.placeId).toBe('fixture-main-il');

    const bare = await mem.gardens.createOwned({
      ownerId: mem.ownerId,
      name: 'Old plot',
      nameNormalized: 'old plot',
      notes: null,
      hardinessZone: null,
      lastFrostMonth: null,
      lastFrostDay: null,
      firstFrostMonth: null,
      firstFrostDay: null,
      lengthInches: 240,
      widthInches: 120,
      formattedAddress: null,
      latitude: null,
      longitude: null,
      placeId: null,
    });
    const loaded = await mem.service.get(mem.ownerId, bare.id);
    expect(loaded.place).toBeNull();

    await mem.memberships.insert(created.id, mem.friendId, 'viewer');
    await expect(
      mem.service.patch(mem.friendId, created.id, { place: WASHINGTON_PLACE }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Viewers cannot update this garden',
    });
  });

  it('replaces hand-edited season facts when the address changes', async () => {
    const { service, ownerId } = createGardenMemory({ climate: new FixtureClimateLookup() });
    const created = await service.create(ownerId, {
      name: 'Season',
      place: WASHINGTON_PLACE,
      hardinessZone: 3,
      lastFrost: { month: 3, day: 1 },
      firstFrost: { month: 11, day: 1 },
    });
    expect(created.hardinessZone).toBe(8);
    expect(created.lastFrost).toEqual({ month: 4, day: 15 });
    expect(created.firstFrost).toEqual({ month: 10, day: 20 });
    expect(created.seasonNotice).toBe('Growing zone and frost dates were updated from this address.');

    const edited = await service.patch(ownerId, created.id, { hardinessZone: 5 });
    expect(edited.hardinessZone).toBe(5);
    expect(edited.place?.placeId).toBe(WASHINGTON_PLACE.placeId);
    expect(edited.seasonNotice).toBeNull();

    const missed = await service.patch(ownerId, created.id, {
      place: MAIN_STREET_PLACES[0],
      hardinessZone: 9,
    });
    expect(missed.hardinessZone).toBeNull();
    expect(missed.lastFrost).toBeNull();
    expect(missed.firstFrost).toBeNull();
    expect(missed.place?.placeId).toBe('fixture-main-il');
    expect(missed.seasonNotice).toBe(
      'This place was saved. Enter the growing zone and frost dates that could not be determined.',
    );
  });
});
