import type { TodayDto } from '@open-garden/shared-types';
import { digestEmail, pushMessage } from './messages';

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface Recipient {
  userId: string;
  email: string;
  emailDigest: boolean;
  push: PushSubscriptionRecord[];
}

export type Channel = 'push' | 'email';

export interface DeliveryStore {
  /** Members with at least one device for push or the daily email on. */
  recipients(): Promise<Recipient[]>;
  /** True when this call took the day's slot; false when it was taken already. */
  claim(userId: string, channel: Channel, day: string): Promise<boolean>;
  /** Gives the slot back after a failed send, so a later run retries. */
  release(userId: string, channel: Channel, day: string): Promise<void>;
  removePush(endpoint: string): Promise<void>;
}

export interface PushSender {
  /** `gone` when the browser has dropped the subscription. */
  send(subscription: PushSubscriptionRecord, payload: string): Promise<'sent' | 'gone'>;
}

export interface EmailSender {
  send(to: string, subject: string, text: string): Promise<void>;
}

/**
 * Sends each member at most one push and one email a day, listing what is
 * due. A channel with no sender configured is skipped.
 */
export class ReminderDelivery {
  constructor(
    private readonly store: DeliveryStore,
    private readonly today: (userId: string, day: string) => Promise<TodayDto>,
    private readonly senders: { push?: PushSender; email?: EmailSender },
    private readonly appUrl = '',
  ) {}

  async run(day: string): Promise<{ push: number; email: number }> {
    const sent = { push: 0, email: 0 };
    for (const recipient of await this.store.recipients()) {
      const wantsPush = this.senders.push && recipient.push.length > 0;
      const wantsEmail = this.senders.email && recipient.emailDigest;
      if (!wantsPush && !wantsEmail) continue;
      let tasks: TodayDto['tasks'];
      try {
        tasks = (await this.today(recipient.userId, day)).tasks;
      } catch {
        continue;
      }
      if (wantsPush && (await this.sendPush(recipient, tasks, day))) sent.push += 1;
      if (wantsEmail && (await this.sendEmail(recipient, tasks, day))) sent.email += 1;
    }
    return sent;
  }

  private async sendPush(recipient: Recipient, tasks: TodayDto['tasks'], day: string) {
    const payload = pushMessage(tasks);
    if (!payload || !(await this.store.claim(recipient.userId, 'push', day))) return false;
    let delivered = false;
    for (const subscription of recipient.push) {
      try {
        const result = await this.senders.push!.send(subscription, payload);
        if (result === 'gone') await this.store.removePush(subscription.endpoint);
        else delivered = true;
      } catch {
        /* one device failing does not stop the others */
      }
    }
    if (!delivered) await this.store.release(recipient.userId, 'push', day);
    return delivered;
  }

  private async sendEmail(recipient: Recipient, tasks: TodayDto['tasks'], day: string) {
    const message = digestEmail(tasks, this.appUrl);
    if (!message || !(await this.store.claim(recipient.userId, 'email', day))) return false;
    try {
      await this.senders.email!.send(recipient.email, message.subject, message.text);
      return true;
    } catch {
      await this.store.release(recipient.userId, 'email', day);
      return false;
    }
  }
}
