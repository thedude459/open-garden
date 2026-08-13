import type {
  GardenCreateDto,
  GardenDetailDto,
  GardenPatchDto,
  GardenRole,
  GardenSummaryDto,
  MemberDto,
  MonthDayDto,
  PageDto,
} from '@open-garden/shared-types';
import type {
  GardenMembershipRepository,
  GardenRepository,
} from '@open-garden/plant-catalog-data';
import { domainError } from './domain-error';
import { validateSiteProfile } from './site-profile';

export class GardenService {
  constructor(
    private readonly gardens: GardenRepository,
    private readonly memberships: GardenMembershipRepository,
  ) {}

  async create(actorId: string, dto: GardenCreateDto): Promise<GardenDetailDto> {
    const name = requireName(dto.name);
    const nameNormalized = normalizeName(name);
    validateNotes(dto.notes);
    validateSiteProfile({
      hardinessZone: dto.hardinessZone,
      lastFrost: dto.lastFrost,
      firstFrost: dto.firstFrost,
    });
    const taken = await this.gardens.findOwnedByNormalizedName(actorId, nameNormalized);
    if (taken) {
      throw domainError('CONFLICT', 'You already own a garden with that name');
    }
    const frost = frostColumns(dto.lastFrost ?? null, dto.firstFrost ?? null);
    const garden = await this.gardens.createOwned({
      ownerId: actorId,
      name,
      nameNormalized,
      notes: normalizeNotes(dto.notes ?? null),
      hardinessZone: dto.hardinessZone ?? null,
      ...frost,
    });
    return this.toDetail(garden, actorId);
  }

  async list(actorId: string, page = 1, pageSize = 20): Promise<PageDto<GardenSummaryDto>> {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const result = await this.gardens.listForUser(actorId, safePage, safeSize);
    return {
      items: result.items.map((g) => ({
        id: g.id,
        name: g.name,
        hardinessZone: g.hardinessZone,
        myRole: g.myRole,
      })),
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

  async patch(actorId: string, gardenId: string, dto: GardenPatchDto): Promise<GardenDetailDto> {
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
    const nextZone =
      dto.hardinessZone !== undefined ? dto.hardinessZone : garden.hardinessZone;
    const nextLast =
      dto.lastFrost !== undefined
        ? dto.lastFrost
        : toMonthDay(garden.lastFrostMonth, garden.lastFrostDay);
    const nextFirst =
      dto.firstFrost !== undefined
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
      ...frost,
    });
    if (!updated) throw domainError('NOT_FOUND', 'Garden not found');
    return this.toDetail(updated, actorId);
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
      updatedAt: Date | string;
    },
    actorId: string,
  ): Promise<GardenDetailDto> {
    const members = await this.memberships.listMembers(garden.id);
    const mine = members.find((m) => m.userId === actorId);
    if (!mine) throw domainError('NOT_FOUND', 'Garden not found');
    return {
      id: garden.id,
      name: garden.name,
      notes: garden.notes,
      hardinessZone: garden.hardinessZone,
      lastFrost: toMonthDay(garden.lastFrostMonth, garden.lastFrostDay),
      firstFrost: toMonthDay(garden.firstFrostMonth, garden.firstFrostDay),
      myRole: mine.role as GardenRole,
      ownerUserId: garden.ownerId,
      members: members.map(toMember),
      updatedAt: toIso(garden.updatedAt),
    };
  }
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
