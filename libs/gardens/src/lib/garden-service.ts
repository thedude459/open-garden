import type { ClimateLookup } from '@open-garden/garden-place';
import type {
  GardenCreateDto,
  GardenDetailDto,
  GardenPatchDto,
  GardenRole,
  GardenSummaryDto,
  GardenWriteDto,
  MemberDto,
  MonthDayDto,
  PageDto,
  PlaceCandidateDto,
} from '@open-garden/shared-types';
import type {
  GardenMembershipRepository,
  GardenRepository,
} from '@open-garden/plant-catalog-data';
import { domainError } from './domain-error';
import { validateSiteProfile } from './site-profile';

const SEASON_UPDATED = 'Growing zone and frost dates were updated from this address.';
const SEASON_PARTIAL =
  'This place was saved. Enter the growing zone and frost dates that could not be determined.';

export class GardenService {
  constructor(
    private readonly gardens: GardenRepository,
    private readonly memberships: GardenMembershipRepository,
    private readonly climate: ClimateLookup | null = null,
  ) {}

  async create(actorId: string, dto: GardenCreateDto): Promise<GardenWriteDto> {
    const name = requireName(dto.name);
    const nameNormalized = normalizeName(name);
    validateNotes(dto.notes);
    const place = requirePlace(dto.place, 'A garden address is required');
    const season = await this.seasonFrom(place, dto);
    const taken = await this.gardens.findOwnedByNormalizedName(actorId, nameNormalized);
    if (taken) {
      throw domainError('CONFLICT', 'You already own a garden with that name');
    }
    const garden = await this.gardens.createOwned({
      ownerId: actorId,
      name,
      nameNormalized,
      notes: normalizeNotes(dto.notes ?? null),
      hardinessZone: season.hardinessZone,
      lengthInches: gardenInches(dto.lengthInches ?? DEFAULT_LENGTH_INCHES),
      widthInches: gardenInches(dto.widthInches ?? DEFAULT_WIDTH_INCHES),
      ...frostColumns(season.lastFrost, season.firstFrost),
      ...placeColumns(place),
    });
    return { ...(await this.toDetail(garden, actorId)), seasonNotice: season.seasonNotice };
  }

  async list(actorId: string, page = 1, pageSize = 20): Promise<PageDto<GardenSummaryDto>> {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const result = await this.gardens.listForUser(actorId, safePage, safeSize);
    const counts = await this.gardens.countsForGardenIds(result.items.map((g) => g.id));
    return {
      items: result.items.map((g) => {
        const c = counts.get(g.id) ?? { bedCount: 0, placementCount: 0 };
        return {
          id: g.id,
          name: g.name,
          hardinessZone: g.hardinessZone,
          myRole: g.myRole,
          bedCount: c.bedCount,
          placementCount: c.placementCount,
        };
      }),
      page: result.page,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
    };
  }

  async get(actorId: string, gardenId: string): Promise<GardenDetailDto> {
    const membership = await this.memberships.get(gardenId, actorId);
    if (!membership) throw domainError('NOT_FOUND', 'Garden not found');
    const garden = await this.gardens.getById(gardenId);
    if (!garden) throw domainError('NOT_FOUND', 'Garden not found');
    return this.toDetail(garden, actorId);
  }

  async patch(actorId: string, gardenId: string, dto: GardenPatchDto): Promise<GardenWriteDto> {
    const membership = await this.memberships.get(gardenId, actorId);
    if (!membership) throw domainError('NOT_FOUND', 'Garden not found');
    if (membership.role === 'viewer') {
      throw domainError('FORBIDDEN', 'Viewers cannot update this garden');
    }
    const garden = await this.gardens.getById(gardenId);
    if (!garden) throw domainError('NOT_FOUND', 'Garden not found');

    const nextName = dto.name !== undefined ? requireName(dto.name) : garden.name;
    const nextNotes = dto.notes !== undefined ? normalizeNotes(dto.notes) : garden.notes;
    if (dto.notes !== undefined) validateNotes(dto.notes);
    const nextPlace = dto.place !== undefined ? requirePlace(dto.place, 'A confirmed garden address is required') : null;
    const season = nextPlace ? await this.seasonFrom(nextPlace, dto) : null;
    const nextZone = season
      ? season.hardinessZone
      : dto.hardinessZone !== undefined
        ? dto.hardinessZone
        : garden.hardinessZone;
    const nextLast = season
      ? season.lastFrost
      : dto.lastFrost !== undefined
        ? dto.lastFrost
        : toMonthDay(garden.lastFrostMonth, garden.lastFrostDay);
    const nextFirst = season
      ? season.firstFrost
      : dto.firstFrost !== undefined
        ? dto.firstFrost
        : toMonthDay(garden.firstFrostMonth, garden.firstFrostDay);

    validateSiteProfile({
      hardinessZone: nextZone,
      lastFrost: nextLast,
      firstFrost: nextFirst,
    });

    const nameNormalized = normalizeName(nextName);
    if (nameNormalized !== garden.nameNormalized) {
      const taken = await this.gardens.findOwnedByNormalizedName(
        garden.ownerId,
        nameNormalized,
        garden.id,
      );
      if (taken) {
        throw domainError('CONFLICT', 'The owner already has a garden with that name');
      }
    }

    const frost = frostColumns(nextLast, nextFirst);
    const updated = await this.gardens.update(garden.id, {
      name: nextName,
      nameNormalized,
      notes: nextNotes,
      hardinessZone: nextZone,
      lengthInches:
        dto.lengthInches !== undefined ? gardenInches(dto.lengthInches) : garden.lengthInches,
      widthInches:
        dto.widthInches !== undefined ? gardenInches(dto.widthInches) : garden.widthInches,
      ...frost,
      ...(nextPlace ? placeColumns(nextPlace) : {}),
    });
    if (!updated) throw domainError('NOT_FOUND', 'Garden not found');
    return {
      ...(await this.toDetail(updated, actorId)),
      seasonNotice: season?.seasonNotice ?? null,
    };
  }

  async remove(actorId: string, gardenId: string): Promise<void> {
    const membership = await this.memberships.get(gardenId, actorId);
    if (!membership) throw domainError('NOT_FOUND', 'Garden not found');
    if (membership.role !== 'owner') {
      throw domainError('FORBIDDEN', 'Only the owner can delete this garden');
    }
    await this.gardens.hardDelete(gardenId);
  }

  private async toDetail(
    garden: {
      id: string;
      ownerId: string;
      name: string;
      notes: string | null;
      hardinessZone: number | null;
      lastFrostMonth: number | null;
      lastFrostDay: number | null;
      firstFrostMonth: number | null;
      firstFrostDay: number | null;
      lengthInches: number;
      widthInches: number;
      formattedAddress?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      placeId?: string | null;
      updatedAt: Date | string;
    },
    actorId: string,
  ): Promise<GardenDetailDto> {
    const members = await this.memberships.listMembers(garden.id);
    const mine = members.find((m) => m.userId === actorId);
    if (!mine) throw domainError('NOT_FOUND', 'Garden not found');
    const counts = await this.gardens.countsForGardenIds([garden.id]);
    const c = counts.get(garden.id) ?? { bedCount: 0, placementCount: 0 };
    return {
      id: garden.id,
      name: garden.name,
      notes: garden.notes,
      hardinessZone: garden.hardinessZone,
      lastFrost: toMonthDay(garden.lastFrostMonth, garden.lastFrostDay),
      firstFrost: toMonthDay(garden.firstFrostMonth, garden.firstFrostDay),
      lengthInches: garden.lengthInches,
      widthInches: garden.widthInches,
      myRole: mine.role as GardenRole,
      ownerUserId: garden.ownerId,
      members: members.map(toMember),
      updatedAt: toIso(garden.updatedAt),
      bedCount: c.bedCount,
      placementCount: c.placementCount,
      place: storedPlace(garden),
    };
  }

  private async seasonFrom(
    place: PlaceCandidateDto,
    dto: { hardinessZone?: number | null; lastFrost?: MonthDayDto | null; firstFrost?: MonthDayDto | null },
  ): Promise<{
    hardinessZone: number | null;
    lastFrost: MonthDayDto | null;
    firstFrost: MonthDayDto | null;
    seasonNotice: string | null;
  }> {
    if (!this.climate) {
      const lastFrost = dto.lastFrost ?? null;
      const firstFrost = dto.firstFrost ?? null;
      validateSiteProfile({
        hardinessZone: dto.hardinessZone,
        lastFrost,
        firstFrost,
      });
      return {
        hardinessZone: dto.hardinessZone ?? null,
        lastFrost,
        firstFrost,
        seasonNotice: null,
      };
    }
    let facts = { hardinessZone: null as number | null, lastFrost: null as MonthDayDto | null, firstFrost: null as MonthDayDto | null };
    try {
      facts = await this.climate.lookup(place);
    } catch {
      facts = { hardinessZone: null, lastFrost: null, firstFrost: null };
    }
    const filled = facts.hardinessZone != null && facts.lastFrost != null && facts.firstFrost != null;
    return { ...facts, seasonNotice: filled ? SEASON_UPDATED : SEASON_PARTIAL };
  }
}

const HALF_FOOT_INCHES = 6;
const DEFAULT_LENGTH_INCHES = 240;
const DEFAULT_WIDTH_INCHES = 120;
const MAX_GARDEN_INCHES = 2400;

function gardenInches(inches: number): number {
  const snapped = Math.round(inches / HALF_FOOT_INCHES) * HALF_FOOT_INCHES;
  return Math.min(MAX_GARDEN_INCHES, Math.max(HALF_FOOT_INCHES, snapped));
}

function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw domainError('VALIDATION_ERROR', 'Garden name is required');
  if (trimmed.length > 120) {
    throw domainError('VALIDATION_ERROR', 'Garden name must be at most 120 characters');
  }
  return trimmed;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeNotes(notes: string | null): string | null {
  if (notes == null) return null;
  const t = notes.trim();
  return t.length === 0 ? null : t;
}

function validateNotes(notes: string | null | undefined): void {
  if (notes != null && notes.length > 4000) {
    throw domainError('VALIDATION_ERROR', 'Notes must be at most 4000 characters');
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function requirePlace(place: PlaceCandidateDto | undefined, missing: string): PlaceCandidateDto {
  if (place == null) throw domainError('VALIDATION_ERROR', missing);
  const formattedAddress = place.formattedAddress?.trim() ?? '';
  const placeId = place.placeId?.trim() ?? '';
  const latitude = place.latitude;
  const longitude = place.longitude;
  if (
    !formattedAddress ||
    formattedAddress.length > 300 ||
    !placeId ||
    placeId.length > 300 ||
    typeof latitude !== 'number' ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw domainError('VALIDATION_ERROR', 'A confirmed garden address is required');
  }
  return { ...place, formattedAddress, placeId };
}

function placeColumns(place: PlaceCandidateDto) {
  return {
    formattedAddress: place.formattedAddress,
    latitude: place.latitude,
    longitude: place.longitude,
    placeId: place.placeId,
  };
}

function storedPlace(garden: {
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
}): PlaceCandidateDto | null {
  if (
    garden.formattedAddress == null ||
    garden.latitude == null ||
    garden.longitude == null ||
    garden.placeId == null
  ) {
    return null;
  }
  return {
    formattedAddress: garden.formattedAddress,
    latitude: garden.latitude,
    longitude: garden.longitude,
    placeId: garden.placeId,
    postalCode: null,
    countryCode: null,
  };
}

function toMonthDay(month: number | null, day: number | null): MonthDayDto | null {
  if (month == null || day == null) return null;
  return { month, day };
}

function frostColumns(last: MonthDayDto | null, first: MonthDayDto | null) {
  return {
    lastFrostMonth: last?.month ?? null,
    lastFrostDay: last?.day ?? null,
    firstFrostMonth: first?.month ?? null,
    firstFrostDay: first?.day ?? null,
  };
}

function toMember(row: {
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
}): MemberDto {
  return {
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role as GardenRole,
  };
}
