import { and, eq, inArray, or, sql } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { pushSubscriptions, reminderDeliveries, users } from './schema';

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** A member's reminder settings, their push devices, and the once-a-day send record. */
export class NotificationRepository {
  constructor(private readonly db: AppDatabase) {}

  async settings(userId: string): Promise<{ emailDigest: boolean; pushDevices: number }> {
    const [user] = await this.db
      .select({ emailDigest: users.emailDigest })
      .from(users)
      .where(eq(users.id, userId));
    const [devices] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    return { emailDigest: user?.emailDigest ?? false, pushDevices: devices?.n ?? 0 };
  }

  async setEmailDigest(userId: string, enabled: boolean): Promise<void> {
    await this.db.update(users).set({ emailDigest: enabled }).where(eq(users.id, userId));
  }

  /** A browser's endpoint is unique; signing in as someone else on it moves it to them. */
  async addPush(userId: string, input: PushSubscriptionInput): Promise<void> {
    await this.db
      .insert(pushSubscriptions)
      .values({ userId, ...input })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: input.p256dh, auth: input.auth },
      });
  }

  async removePushForUser(userId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  }

  async removePush(endpoint: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  /** Members with a push device or the daily email on. */
  async recipients() {
    const withPush = this.db.select({ userId: pushSubscriptions.userId }).from(pushSubscriptions);
    const rows = await this.db
      .select({ userId: users.id, email: users.email, emailDigest: users.emailDigest })
      .from(users)
      .where(or(eq(users.emailDigest, true), inArray(users.id, withPush)));
    if (rows.length === 0) return [];
    const devices = await this.db
      .select()
      .from(pushSubscriptions)
      .where(
        inArray(
          pushSubscriptions.userId,
          rows.map((row) => row.userId),
        ),
      );
    return rows.map((row) => ({
      ...row,
      push: devices
        .filter((device) => device.userId === row.userId)
        .map(({ endpoint, p256dh, auth }) => ({ endpoint, p256dh, auth })),
    }));
  }

  /** Takes the day's slot for this member and channel; false when already taken. */
  async claim(userId: string, channel: string, day: string): Promise<boolean> {
    const rows = await this.db
      .insert(reminderDeliveries)
      .values({ userId, channel, sentOn: day })
      .onConflictDoNothing()
      .returning();
    return rows.length > 0;
  }

  async release(userId: string, channel: string, day: string): Promise<void> {
    await this.db
      .delete(reminderDeliveries)
      .where(
        and(
          eq(reminderDeliveries.userId, userId),
          eq(reminderDeliveries.channel, channel),
          eq(reminderDeliveries.sentOn, day),
        ),
      );
  }
}
