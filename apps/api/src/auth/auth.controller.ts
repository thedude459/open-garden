import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService, FailureLimiter, type AuthUser } from '@open-garden/auth';
import {
  authLoginSchema,
  authRegisterSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} from '@open-garden/shared-types';
import type { EmailSender } from '@open-garden/reminder-delivery';
import { domainError } from '@open-garden/gardens';
import { notificationConfig } from '../notifications/notification-config';
import { smtpEmailSender } from '../notifications/senders';
import { resetEmail, resetLink } from './password-reset';
import { DATABASE } from '../database/database.tokens';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import { CurrentUser, SessionGuard } from './session.guard';
import { sessionCookieOptions } from './session-cookie';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

@Controller('auth')
export class AuthController {
  /** Failed sign-ins per email address. */
  private readonly byEmail = new FailureLimiter(5, FIFTEEN_MINUTES);
  /** Failed sign-ins and sign-ups for a taken address, per client IP. */
  private readonly byIp = new FailureLimiter(30, FIFTEEN_MINUTES);
  /** Reset emails per address, sent or not, so nobody floods an inbox. */
  private readonly resetsByEmail = new FailureLimiter(3, FIFTEEN_MINUTES);
  private readonly auth: AuthService;
  private readonly appUrl: string;
  /** Reset links go by email only with SMTP and APP_URL (the link's address) set. */
  private readonly resetMail: EmailSender | null;
  private readonly logger = new Logger(AuthController.name);

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.auth = new AuthService(bundle.db);
    const config = notificationConfig();
    this.appUrl = config.appUrl;
    this.resetMail = config.smtp && config.appUrl ? smtpEmailSender(config.smtp) : null;
  }

  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = authRegisterSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error(parsed.error.issues[0]?.message ?? 'Invalid credentials') as Error & {
        code: string;
      };
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    const { email, password, displayName } = parsed.data;
    const ip = `ip:${clientIp(res)}`;
    throwIfLimited(this.byIp.retryAfterMs(ip));
    let user: AuthUser;
    try {
      user = await this.auth.register(email, password, displayName);
    } catch (err) {
      if ((err as { code?: string }).code === 'CONFLICT') this.byIp.fail(ip);
      throw err;
    }
    const login = await this.auth.login(email, password);
    if (!login) throw new Error('Login after register failed');
    setSessionCookie(res, login.token);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = authLoginSchema.safeParse(body);
    if (!parsed.success) {
      const err = new Error(parsed.error.issues[0]?.message ?? 'Invalid credentials') as Error & {
        code: string;
      };
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    const email = `email:${parsed.data.email.trim().toLowerCase()}`;
    const ip = `ip:${clientIp(res)}`;
    throwIfLimited(Math.max(this.byEmail.retryAfterMs(email), this.byIp.retryAfterMs(ip)));
    const result = await this.auth.login(parsed.data.email, parsed.data.password);
    if (!result) {
      this.byEmail.fail(email);
      this.byIp.fail(ip);
      const err = new Error('Invalid credentials') as Error & { code: string };
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    this.byEmail.clear(email);
    setSessionCookie(res, result.token);
    return { user: result.user };
  }

  /** Whether "Forgot password?" can email a link on this server. */
  @Get('password-reset')
  resetOptions() {
    return { byEmail: this.resetMail !== null };
  }

  /**
   * Email a reset link. Answers the same whether or not an account has the
   * address, and sends in the background so the timing does not tell either.
   */
  @Post('password-reset')
  @HttpCode(204)
  async requestReset(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = passwordResetRequestSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Enter your email address');
    const mail = this.resetMail;
    if (!mail) {
      throw domainError('NOT_FOUND', 'Password reset by email is not set up on this server');
    }
    const email = `email:${parsed.data.email.trim().toLowerCase()}`;
    const ip = `ip:${clientIp(res)}`;
    throwIfLimited(Math.max(this.resetsByEmail.retryAfterMs(email), this.byIp.retryAfterMs(ip)));
    this.resetsByEmail.fail(email);
    this.byIp.fail(ip);
    const reset = await this.auth.createPasswordReset(parsed.data.email);
    if (!reset) return;
    const { subject, text } = resetEmail(resetLink(this.appUrl, reset.token));
    void mail.send(reset.email, subject, text).catch((err: unknown) => {
      this.logger.warn(`password_reset.email_failed ${err instanceof Error ? err.message : err}`);
    });
  }

  /** Set a new password from a reset link; every session of the account ends. */
  @Post('password-reset/confirm')
  @HttpCode(204)
  async confirmReset(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = passwordResetSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request');
    }
    const ip = `ip:${clientIp(res)}`;
    throwIfLimited(this.byIp.retryAfterMs(ip));
    if (!(await this.auth.resetPassword(parsed.data.token, parsed.data.password))) {
      this.byIp.fail(ip);
      throw domainError(
        'VALIDATION_ERROR',
        'This reset link has expired or was already used. Ask for a new one.',
      );
    }
    clearSessionCookie(res);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(@Res({ passthrough: true }) res: Response, @CurrentUser() _user: AuthUser) {
    const token = (res.req as { cookies?: { og_session?: string } }).cookies?.og_session;
    if (token) await this.auth.logout(token);
    clearSessionCookie(res);
  }
}

/**
 * The client's address. Behind the web container, nginx sets X-Real-IP; the
 * API is not published on its own in the Compose files, so the header comes
 * from nginx. Without it (development), the socket's address.
 */
function clientIp(res: Response): string {
  const real = res.req.headers['x-real-ip'];
  return (Array.isArray(real) ? real[0] : real) ?? res.req.socket.remoteAddress ?? 'unknown';
}

export function throwIfLimited(retryAfterMs: number) {
  if (retryAfterMs <= 0) return;
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  const err = new Error(
    `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  ) as Error & { code: string };
  err.code = 'TOO_MANY_REQUESTS';
  throw err;
}

function forwardedProto(res: Response): string | undefined {
  const value = res.req.headers['x-forwarded-proto'];
  return Array.isArray(value) ? value[0] : value;
}

export function clearSessionCookie(res: Response) {
  res.clearCookie('og_session', sessionCookieOptions(forwardedProto(res)));
}

function setSessionCookie(res: Response, token: string) {
  const opts = sessionCookieOptions(forwardedProto(res));
  res.cookie('og_session', token, {
    ...opts,
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });
}
