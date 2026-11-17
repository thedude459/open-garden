import { Body, Controller, HttpCode, Inject, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, FailureLimiter, type AuthUser } from '@open-garden/auth';
import { changePasswordSchema, unitsSchema } from '@open-garden/shared-types';
import { domainError } from '@open-garden/gardens';
import { throwIfLimited } from './auth.controller';
import { CurrentUser, SessionGuard } from './session.guard';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** The signed-in member's own settings. */
@Controller('account')
@UseGuards(SessionGuard)
export class AccountController {
  /** Wrong current passwords per member, so a left-open session cannot guess it. */
  private readonly wrongPassword = new FailureLimiter(5, FIFTEEN_MINUTES);

  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Put('units')
  @HttpCode(204)
  async setUnits(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = unitsSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Units must be imperial or metric');
    await this.auth.setUnits(user.id, parsed.data.units);
  }

  /** Change the password; every other session is signed out. */
  @Put('password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid password');
    }
    throwIfLimited(this.wrongPassword.retryAfterMs(user.id));
    const token = (req as { cookies?: { og_session?: string } }).cookies?.og_session ?? '';
    const { currentPassword, newPassword } = parsed.data;
    if (!(await this.auth.changePassword(user.id, currentPassword, newPassword, token))) {
      this.wrongPassword.fail(user.id);
      // Not 401: that would read as a lapsed session and send the member to sign-in.
      throw domainError('VALIDATION_ERROR', 'The current password is not right.');
    }
    this.wrongPassword.clear(user.id);
  }
}
