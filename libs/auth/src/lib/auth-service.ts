import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import type { Units } from '@open-garden/shared-types';
import {
  gardenMemberships,
  gardens,
  isUniqueViolation,
  passwordResets,
  sessions,
  users,
} from '@open-garden/plant-catalog-data';

/** Why an account was not deleted, or that it was. */
export type DeleteAccountResult =
  | { deleted: true }
  | { deleted: false; reason: 'wrong-password' }
  | { deleted: false; reason: 'shared-properties'; properties: string[] };

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  units: Units;
}

export class AuthService {
  constructor(private readonly db: AppDatabase) {}

  async register(email: string, password: string, displayName?: string): Promise<AuthUser> {
    const passwordHash = await bcrypt.hash(password, 10);
    let user: typeof users.$inferSelect | undefined;
    try {
      [user] = await this.db
        .insert(users)
        .values({
          email: email.trim().toLowerCase(),
          passwordHash,
          displayName: displayName ?? null,
          role: 'user',
        })
        .returning();
    } catch (err) {
      // The unique constraint decides, so two sign-ups racing for one email
      // get the same answer as a second sign-up later.
      if (isUniqueViolation(err)) throw emailTaken();
      throw err;
    }
    if (!user) throw new Error('Registration failed');
    return mapUser(user);
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; token: string } | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    await this.db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    // Expired sessions are useless; clearing them on each sign-in keeps the
    // table bounded without a scheduled job.
    await this.db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    return { user: mapUser(user), token };
  }

  async logout(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  async resolveSession(token: string): Promise<AuthUser | null> {
    const tokenHash = hashToken(token);
    const [row] = await this.db
      .select({
        user: users,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
      .limit(1);
    return row ? mapUser(row.user) : null;
  }

  /**
   * Give an existing account the admin role. Never creates an account: email
   * addresses are not verified, so promoting at sign-up would let whoever
   * registers the address first become admin. Returns false when no account
   * has that email yet.
   */
  async promoteToAdmin(email: string): Promise<boolean> {
    const rows = await this.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.email, email.trim().toLowerCase()))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  /**
   * Change a member's password after checking the current one, and sign out
   * every other session, so a device someone else may hold loses access.
   * The session making the change (`keepToken`) stays signed in. False when
   * the current password is wrong.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepToken: string,
  ): Promise<boolean> {
    if (!(await this.passwordMatches(userId, currentPassword))) return false;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
      await tx
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, hashToken(keepToken))));
    });
    return true;
  }

  /**
   * Delete a member's account after checking their password. Their sessions,
   * memberships, and the properties only they belong to go with it (the
   * foreign keys cascade). Refused while they own a property someone else
   * also belongs to: they hand it over or delete it first, so nobody loses a
   * shared property by surprise.
   */
  async deleteAccount(userId: string, password: string): Promise<DeleteAccountResult> {
    if (!(await this.passwordMatches(userId, password))) {
      return { deleted: false, reason: 'wrong-password' };
    }
    return this.db.transaction(async (tx) => {
      const shared = await tx
        .selectDistinct({ name: gardens.name })
        .from(gardens)
        .innerJoin(gardenMemberships, eq(gardenMemberships.gardenId, gardens.id))
        .where(and(eq(gardens.ownerId, userId), ne(gardenMemberships.userId, userId)))
        .orderBy(gardens.name);
      if (shared.length) {
        return {
          deleted: false as const,
          reason: 'shared-properties' as const,
          properties: shared.map((g) => g.name),
        };
      }
      await tx.delete(users).where(eq(users.id, userId));
      return { deleted: true as const };
    });
  }

  private async passwordMatches(userId: string, password: string): Promise<boolean> {
    const [user] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return Boolean(user && (await bcrypt.compare(password, user.passwordHash)));
  }

  /**
   * A one-time reset link token for the account with this email, valid for an
   * hour; any earlier link for it stops working. Null when no account has the
   * address (callers must not reveal that to whoever asked).
   */
  async createPasswordReset(email: string): Promise<{ email: string; token: string } | null> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    if (!user) return null;
    const token = randomBytes(32).toString('hex');
    await this.db.transaction(async (tx) => {
      await tx.delete(passwordResets).where(eq(passwordResets.userId, user.id));
      await tx.insert(passwordResets).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_LINK_MS),
      });
    });
    return { email: user.email, token };
  }

  /**
   * Set a new password from a reset link. The link works once; every session
   * of the account is signed out. False when the link is unknown or expired.
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.db.transaction(async (tx) => {
      const [reset] = await tx
        .delete(passwordResets)
        .where(
          and(
            eq(passwordResets.tokenHash, hashToken(token)),
            gt(passwordResets.expiresAt, new Date()),
          ),
        )
        .returning({ userId: passwordResets.userId });
      if (!reset) return false;
      await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
      await tx.delete(sessions).where(eq(sessions.userId, reset.userId));
      return true;
    });
  }

  async setUnits(userId: string, units: Units): Promise<void> {
    await this.db.update(users).set({ units }).where(eq(users.id, userId));
  }

  async ensureAdmin(email: string, password: string): Promise<AuthUser> {
    const existing = await this.login(email, password);
    if (existing) {
      await this.db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.user.id));
      return { ...existing.user, role: 'admin' };
    }
    const user = await this.register(email, password, 'Admin');
    await this.db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
    return { ...user, role: 'admin' };
  }
}

/** How long a password reset link works. */
export const RESET_LINK_MS = 60 * 60 * 1000;

export const EMAIL_TAKEN_MESSAGE = 'An account with this email already exists. Sign in instead.';

function emailTaken(): Error & { code: 'CONFLICT' } {
  const err = new Error(EMAIL_TAKEN_MESSAGE) as Error & { code: 'CONFLICT' };
  err.code = 'CONFLICT';
  return err;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function mapUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  units: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    units: user.units === 'metric' ? 'metric' : 'imperial',
  };
}
