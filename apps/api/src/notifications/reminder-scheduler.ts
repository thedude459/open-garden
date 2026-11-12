import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { NotificationRepository, type AppDatabase } from '@open-garden/plant-catalog-data';
import { ReminderDelivery, todayFor } from '@open-garden/reminder-delivery';
import { DATABASE } from '../database/database.tokens';
import { todaySources } from '../gardens/today-sources';
import { notificationConfig } from './notification-config';
import { smtpEmailSender, webPushSender } from './senders';

const CHECK_EVERY_MS = 10 * 60 * 1000;

/** The server's calendar day, `YYYY-MM-DD`. */
export function localDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Sends the day's reminders once the configured hour has passed, in the
 * server's time zone (TZ). Checks every ten minutes; each member gets at most
 * one push and one email a day, so restarts and several API instances do not
 * send twice.
 */
@Injectable()
export class ReminderScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ReminderScheduler.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly delivery: ReminderDelivery | null;
  private readonly hour: number;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    const config = notificationConfig();
    this.hour = config.reminderHour;
    const push = config.push ? webPushSender(config.push) : undefined;
    const email = config.smtp ? smtpEmailSender(config.smtp) : undefined;
    const sources = todaySources(bundle.db);
    this.delivery =
      push || email
        ? new ReminderDelivery(
            new NotificationRepository(bundle.db),
            (userId, day) => todayFor(sources, userId, day),
            { push, email },
            config.appUrl,
          )
        : null;
  }

  onApplicationBootstrap() {
    if (!this.delivery) return;
    this.logger.log(`reminders.scheduled hour=${this.hour}`);
    void this.tick();
    this.timer = setInterval(() => void this.tick(), CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()) {
    if (!this.delivery || this.running || now.getHours() < this.hour) return;
    this.running = true;
    // ponytail: every tick after the hour rebuilds Today for each recipient,
    // even ones already sent (the claim only stops a second send). Fine for a
    // household; for many members, skip users with today's slots taken in
    // recipients().
    try {
      const sent = await this.delivery.run(localDay(now));
      if (sent.push || sent.email) {
        this.logger.log(`reminders.sent push=${sent.push} email=${sent.email}`);
      }
    } catch (err) {
      this.logger.error(`reminders.failed ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
