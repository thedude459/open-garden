import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '@open-garden/auth';
import { GardenMembershipRepository, type AppDatabase } from '@open-garden/plant-catalog-data';
import { Inject } from '@nestjs/common';
import { CURRENT_USER } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { isUuid } from '../common/ids';

export const GARDEN_MEMBERSHIP = 'gardenMembership';

export interface GardenMembershipContext {
  gardenId: string;
  userId: string;
  role: string;
}

@Injectable()
export class GardenMembershipGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly bundle: { db: AppDatabase }) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        [CURRENT_USER]?: AuthUser;
        [GARDEN_MEMBERSHIP]?: GardenMembershipContext;
        params: { id?: string };
      }
    >();
    const user = req[CURRENT_USER];
    const gardenId = req.params['id'];
    if (!user || !gardenId) return true;
    // A malformed id names no property, so it is not found, not a server error.
    const membership = isUuid(gardenId)
      ? await new GardenMembershipRepository(this.bundle.db).get(gardenId, user.id)
      : null;
    if (!membership) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Garden not found' },
      });
    }
    req[GARDEN_MEMBERSHIP] = {
      gardenId: membership.gardenId,
      userId: membership.userId,
      role: membership.role,
    };
    return true;
  }
}
