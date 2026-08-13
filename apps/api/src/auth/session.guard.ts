import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '@open-garden/auth';
import { AuthService } from '@open-garden/auth';

export const CURRENT_USER = 'currentUser';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { [CURRENT_USER]?: AuthUser }>();
    const token = req.cookies?.['og_session'] as string | undefined;
    if (!token) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    const user = await this.auth.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    req[CURRENT_USER] = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { [CURRENT_USER]?: AuthUser }>();
  return req[CURRENT_USER];
});
