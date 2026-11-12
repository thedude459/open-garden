import { Body, Controller, Delete, Get, HttpCode, Inject, Put, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { domainError } from '@open-garden/gardens';
import { NotificationRepository, type AppDatabase } from '@open-garden/plant-catalog-data';
import {
  emailDigestSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  type NotificationSettingsDto,
} from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { notificationConfig, type NotificationConfig } from './notification-config';

/** A member's own reminder settings; nothing here reads or changes another member's. */
@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  private readonly repo: NotificationRepository;
  private readonly config: NotificationConfig;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.repo = new NotificationRepository(bundle.db);
    this.config = notificationConfig();
  }

  @Get()
  async settings(@CurrentUser() user: AuthUser): Promise<NotificationSettingsDto> {
    const mine = await this.repo.settings(user.id);
    return {
      pushAvailable: this.config.push !== null,
      vapidPublicKey: this.config.push?.publicKey ?? null,
      emailAvailable: this.config.smtp !== null,
      emailDigest: mine.emailDigest,
      pushDevices: mine.pushDevices,
      reminderHour: this.config.reminderHour,
    };
  }

  @Put('push')
  @HttpCode(204)
  async subscribe(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<void> {
    if (!this.config.push) throw domainError('VALIDATION_ERROR', 'Push reminders are not set up');
    const parsed = pushSubscriptionSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Invalid push subscription');
    await this.repo.addPush(user.id, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
  }

  @Delete('push')
  @HttpCode(204)
  async unsubscribe(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<void> {
    const parsed = pushUnsubscribeSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Invalid push subscription');
    await this.repo.removePushForUser(user.id, parsed.data.endpoint);
  }

  @Put('email')
  @HttpCode(204)
  async email(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<void> {
    const parsed = emailDigestSchema.safeParse(body);
    if (!parsed.success) throw domainError('VALIDATION_ERROR', 'Choose on or off');
    if (parsed.data.enabled && !this.config.smtp) {
      throw domainError('VALIDATION_ERROR', 'Email reminders are not set up');
    }
    await this.repo.setEmailDigest(user.id, parsed.data.enabled);
  }
}
