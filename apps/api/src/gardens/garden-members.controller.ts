import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { MembershipService, domainError } from '@open-garden/gardens';
import {
  GardenMembershipRepository,
  GardenRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { gardenInviteSchema, gardenMemberPatchSchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';

@Controller('gardens/:id/members')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenMembersController {
  private readonly memberships: MembershipService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.memberships = new MembershipService(
      new GardenRepository(bundle.db),
      new GardenMembershipRepository(bundle.db),
    );
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('id') gardenId: string) {
    return this.memberships.list(user.id, gardenId);
  }

  @Post()
  @HttpCode(201)
  invite(@CurrentUser() user: AuthUser, @Param('id') gardenId: string, @Body() body: unknown) {
    const parsed = gardenInviteSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid invite');
    }
    return this.memberships.invite(user.id, gardenId, parsed.data);
  }

  @Patch(':userId')
  patchMember(
    @CurrentUser() user: AuthUser,
    @Param('id') gardenId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    const parsed = gardenMemberPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid member');
    }
    return this.memberships.patchMember(user.id, gardenId, userId, parsed.data);
  }

  @Delete(':userId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') gardenId: string,
    @Param('userId') userId: string,
  ) {
    return this.memberships.removeMember(user.id, gardenId, userId);
  }
}
