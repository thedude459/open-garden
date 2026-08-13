import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService, type AuthUser } from '@open-garden/auth';
import { authLoginSchema, authRegisterSchema } from '@open-garden/shared-types';
import { DATABASE } from '../database/database.tokens';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import { CurrentUser, SessionGuard } from './session.guard';

@Controller('auth')
export class AuthController {
  private readonly auth: AuthService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.auth = new AuthService(bundle.db);
  }

  @Post('register')
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = authRegisterSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error(parsed.error.issues[0]?.message ?? 'Invalid credentials') as Error & {
        code: string;
      };
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    const { email, password, displayName } = parsed.data;
    const user = await this.auth.register(email, password, displayName);
    const login = await this.auth.login(email, password);
    if (!login) throw new Error('Login after register failed');
    setSessionCookie(res, login.token);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = authLoginSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error(parsed.error.issues[0]?.message ?? 'Invalid credentials') as Error & {
        code: string;
      };
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    const result = await this.auth.login(parsed.data.email, parsed.data.password);
    if (!result) {
      const err = new Error('Invalid credentials') as Error & { code: string };
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    setSessionCookie(res, result.token);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() _user: AuthUser,
  ) {
    const token = (res.req as { cookies?: { og_session?: string } }).cookies?.og_session;
    if (token) await this.auth.logout(token);
    res.clearCookie('og_session');
  }
}

function setSessionCookie(res: Response, token: string) {
  res.cookie('og_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 14,
    path: '/',
  });
}
