import { Body, Controller, HttpCode, Inject, Put, UseGuards } from '@nestjs/common';
import { AuthService, type AuthUser } from '@open-garden/auth';
import { unitsSchema } from '@open-garden/shared-types';
import { domainError } from '@open-garden/gardens';
import { CurrentUser, SessionGuard } from './session.guard';

/** The signed-in member's own settings. */
@Controller('account')
@UseGuards(SessionGuard)
export class AccountController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Put('units')
  @HttpCode(204)
  async setUnits(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = unitsSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Units must be imperial or metric');
    await this.auth.setUnits(user.id, parsed.data.units);
  }
}
