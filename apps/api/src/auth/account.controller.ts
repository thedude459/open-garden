import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, FailureLimiter, type AuthUser } from '@open-garden/auth';
import { changePasswordSchema, deleteAccountSchema, unitsSchema } from '@open-garden/shared-types';
import { domainError } from '@open-garden/gardens';
import { clearSessionCookie, throwIfLimited } from './auth.controller';
import { securityEvent } from '../common/security-log';
import { CurrentUser, SessionGuard } from './session.guard';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** The signed-in member's own settings. */
@Controller('account')
@UseGuards(SessionGuard)
export class AccountController {
  /** Wrong passwords per member, so a left-open session cannot guess it. */
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
    throwIfLimited(this.wrongPassword.retryAfterMs(user.id), 'password_change', { user: user.id });
    const token = (req as { cookies?: { og_session?: string } }).cookies?.og_session ?? '';
    const { currentPassword, newPassword } = parsed.data;
    if (!(await this.auth.changePassword(user.id, currentPassword, newPassword, token))) {
      this.wrongPassword.fail(user.id);
      securityEvent('password_change_failed', { user: user.id }, 'warn');
      // Not 401: that would read as a lapsed session and send the member to sign-in.
      throw domainError('VALIDATION_ERROR', 'The current password is not right.');
    }
    this.wrongPassword.clear(user.id);
    securityEvent('password_changed', { user: user.id });
  }

  /**
   * Delete the account. Refused (409) while the member owns a property others
   * also belong to; the message names those properties.
   */
  @Delete()
  @HttpCode(204)
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Enter your password');
    throwIfLimited(this.wrongPassword.retryAfterMs(user.id), 'account_delete', { user: user.id });
    const result = await this.auth.deleteAccount(user.id, parsed.data.password);
    if (result.deleted) {
      this.wrongPassword.clear(user.id);
      securityEvent('account_deleted', { user: user.id });
      clearSessionCookie(res);
      return;
    }
    if (result.reason === 'wrong-password') {
      this.wrongPassword.fail(user.id);
      securityEvent('account_delete_failed', { user: user.id }, 'warn');
      throw domainError('VALIDATION_ERROR', 'The password is not right.');
    }
    throw domainError(
      'CONFLICT',
      `Others belong to ${result.properties.join(', ')}. Before deleting your account, ` +
        `transfer ownership to a member in Settings, or delete the property.`,
    );
  }
}
