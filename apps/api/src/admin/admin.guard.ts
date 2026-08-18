import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { PIPELINE_ERRORS } from '@open-garden/catalog-pipeline';
import { CURRENT_USER } from '../auth/session.guard';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ [CURRENT_USER]?: AuthUser }>();
    const user = req[CURRENT_USER];
    if (!user || user.role !== 'admin') {
      throw PIPELINE_ERRORS.adminRequired();
    }
    return true;
  }
}
