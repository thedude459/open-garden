import type { GardenInviteDto, GardenMemberPatchDto, GardenRole, MemberDto } from '@open-garden/shared-types';
import type {
  GardenMembershipRepository,
  GardenRepository,
} from '@open-garden/plant-catalog-data';
import { domainError } from './domain-error';

export class MembershipService {
  constructor(
    private readonly gardens: GardenRepository,
    private readonly memberships: GardenMembershipRepository,
  ) {}

  async list(actorId: string, gardenId: string): Promise<{ members: MemberDto[] }> {
    const membership = await this.memberships.get(gardenId, actorId);
    if (!membership) throw domainError('NOT_FOUND', 'Garden not found');
    const members = await this.memberships.listMembers(gardenId);
    return { members: members.map(toMember) };
  }

  async invite(actorId: string, gardenId: string, dto: GardenInviteDto): Promise<MemberDto> {
    await this.requireOwner(actorId, gardenId);
    const email = dto.email.trim().toLowerCase();
    const account = await this.memberships.findUserByEmail(email);
    if (!account) {
      throw domainError('NOT_FOUND', 'That email does not have an account yet');
    }
    if (account.id === actorId) {
      throw domainError('VALIDATION_ERROR', 'You are already the owner of this garden');
    }
    const existing = await this.memberships.get(gardenId, account.id);
    if (existing) {
      throw domainError('CONFLICT', 'That person is already a member');
    }
    if (dto.role === ('owner' as string)) {
      throw domainError('VALIDATION_ERROR', 'Invite role must be collaborator or viewer');
    }
    await this.memberships.insert(gardenId, account.id, dto.role);
    return {
      userId: account.id,
      email: account.email,
      displayName: account.displayName,
      role: dto.role,
    };
  }

  async patchMember(
    actorId: string,
    gardenId: string,
    targetUserId: string,
    dto: GardenMemberPatchDto,
  ): Promise<MemberDto> {
    await this.requireOwner(actorId, gardenId);
    const target = await this.memberships.get(gardenId, targetUserId);
    if (!target) throw domainError('NOT_FOUND', 'Member not found');

    if (dto.role === 'owner') {
      return this.transfer(actorId, gardenId, targetUserId);
    }
    if (target.role === 'owner') {
      throw domainError(
        'VALIDATION_ERROR',
        'Transfer ownership before changing the owner role',
      );
    }
    await this.memberships.updateRole(gardenId, targetUserId, dto.role);
    return this.memberDto(gardenId, targetUserId);
  }

  async removeMember(actorId: string, gardenId: string, targetUserId: string): Promise<void> {
    const actor = await this.memberships.get(gardenId, actorId);
    if (!actor) throw domainError('NOT_FOUND', 'Garden not found');

    if (actorId === targetUserId) {
      if (actor.role === 'owner') {
        throw domainError(
          'FORBIDDEN',
          'Transfer ownership or delete the garden before leaving',
        );
      }
      await this.memberships.delete(gardenId, actorId);
      return;
    }

    if (actor.role !== 'owner') {
      throw domainError('FORBIDDEN', 'Only the owner can remove other members');
    }
    const target = await this.memberships.get(gardenId, targetUserId);
    if (!target) throw domainError('NOT_FOUND', 'Member not found');
    if (target.role === 'owner') {
      throw domainError('FORBIDDEN', 'Transfer ownership before removing the owner');
    }
    await this.memberships.delete(gardenId, targetUserId);
  }

  private async transfer(
    actorId: string,
    gardenId: string,
    targetUserId: string,
  ): Promise<MemberDto> {
    if (targetUserId === actorId) {
      throw domainError('VALIDATION_ERROR', 'You already own this garden');
    }
    const garden = await this.gardens.getById(gardenId);
    if (!garden) throw domainError('NOT_FOUND', 'Garden not found');
    const target = await this.memberships.get(gardenId, targetUserId);
    if (!target) throw domainError('NOT_FOUND', 'Member not found');

    const clash = await this.gardens.findOwnedByNormalizedName(
      targetUserId,
      garden.nameNormalized,
    );
    if (clash) {
      throw domainError(
        'CONFLICT',
        'The new owner already has a garden with that name',
      );
    }

    // Demote the current owner first so the partial unique owner index is never
    // violated (two owner rows in the same garden).
    await this.gardens.transferOwner(gardenId, actorId, targetUserId);
    return this.memberDto(gardenId, targetUserId);
  }

  private async requireOwner(actorId: string, gardenId: string) {
    const membership = await this.memberships.get(gardenId, actorId);
    if (!membership) throw domainError('NOT_FOUND', 'Garden not found');
    if (membership.role !== 'owner') {
      throw domainError('FORBIDDEN', 'Only the owner can manage membership');
    }
  }

  private async memberDto(gardenId: string, userId: string): Promise<MemberDto> {
    const members = await this.memberships.listMembers(gardenId);
    const row = members.find((m) => m.userId === userId);
    if (!row) throw domainError('NOT_FOUND', 'Member not found');
    return toMember(row);
  }
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
