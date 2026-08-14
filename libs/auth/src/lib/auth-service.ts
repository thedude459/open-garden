import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, gt } from 'drizzle-orm';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import { sessions, users } from '@open-garden/plant-catalog-data';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

export class AuthService {
  constructor(private readonly db: AppDatabase) {}

  async register(email: string, password: string, displayName?: string): Promise<AuthUser> {
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await this.db
      .insert(users)
      .values({
        email: email.trim().toLowerCase(),
        passwordHash,
        displayName: displayName ?? null,
        role: 'user',
      })
      .returning();
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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function mapUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}
