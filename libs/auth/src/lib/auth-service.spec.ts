import bcrypt from 'bcryptjs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthService, EMAIL_TAKEN_MESSAGE, RESET_LINK_MS } from './auth-service';

describe('AuthService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a user', async () => {
    const returning = vi
      .fn()
      .mockResolvedValue([{ id: 'u1', email: 'a@example.com', displayName: 'A', role: 'user' }]);
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning }),
      }),
    };
    const svc = new AuthService(db as never);
    const user = await svc.register('A@Example.com', 'password123', 'A');
    expect(user).toEqual({
      id: 'u1',
      email: 'a@example.com',
      displayName: 'A',
      role: 'user',
      units: 'imperial',
    });
  });

  it('carries a member’s units and saves a change', async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const returning = vi
      .fn()
      .mockResolvedValue([
        { id: 'u1', email: 'a@example.com', displayName: null, role: 'user', units: 'metric' },
      ]);
    const db = {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) }),
      update: vi.fn().mockReturnValue({ set }),
    };
    const svc = new AuthService(db as never);
    expect((await svc.register('a@example.com', 'password123')).units).toBe('metric');
    await svc.setUnits('u1', 'imperial');
    expect(set).toHaveBeenCalledWith({ units: 'imperial' });
  });

  it('turns a duplicate email into a CONFLICT instead of a raw query error', async () => {
    // Drizzle wraps the pg error; the unique-violation code sits on `cause`.
    const dbError = Object.assign(new Error('Failed query: insert into "users" ... params: x'), {
      cause: { code: '23505' },
    });
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockRejectedValue(dbError) }),
      }),
    };
    const svc = new AuthService(db as never);
    await expect(svc.register('taken@example.com', 'password123')).rejects.toMatchObject({
      code: 'CONFLICT',
      message: EMAIL_TAKEN_MESSAGE,
    });
  });

  it('rethrows other insert failures unchanged', async () => {
    const dbError = new Error('connection refused');
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockRejectedValue(dbError) }),
      }),
    };
    const svc = new AuthService(db as never);
    await expect(svc.register('a@example.com', 'password123')).rejects.toBe(dbError);
  });

  it('promotes an existing account to admin by email, case-insensitively', async () => {
    const where = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'u1' }]) });
    const set = vi.fn().mockReturnValue({ where });
    const db = { update: vi.fn().mockReturnValue({ set }) };
    const svc = new AuthService(db as never);
    await expect(svc.promoteToAdmin('  Me@Example.com ')).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith({ role: 'admin' });
  });

  it('reports false and creates nothing when no account has the admin email', async () => {
    const db = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
      }),
      insert: vi.fn(),
    };
    const svc = new AuthService(db as never);
    await expect(svc.promoteToAdmin('nobody@example.com')).resolves.toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns null on bad login', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const svc = new AuthService(db as never);
    await expect(svc.login('missing@example.com', 'x')).resolves.toBeNull();
  });

  it('logs in and creates a session', async () => {
    const hash = await import('bcryptjs').then((b) => b.hash('password123', 4));
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'u1',
                email: 'a@example.com',
                displayName: null,
                role: 'user',
                passwordHash: hash,
              },
            ]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    };
    const svc = new AuthService(db as never);
    const result = await svc.login('a@example.com', 'password123');
    expect(result?.user.id).toBe('u1');
    expect(result?.token).toHaveLength(64);
    // Expired sessions are cleared on sign-in.
    expect(db.delete).toHaveBeenCalled();
  });

  it('resolves a valid session', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  user: {
                    id: 'u1',
                    email: 'a@example.com',
                    displayName: null,
                    role: 'user',
                  },
                  expiresAt: new Date(Date.now() + 60_000),
                },
              ]),
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    };
    const svc = new AuthService(db as never);
    const user = await svc.resolveSession('abc');
    expect(user?.email).toBe('a@example.com');
    await svc.logout('abc');
    expect(db.delete).toHaveBeenCalled();
  });

  describe('changePassword', () => {
    async function setup(current = 'old-password') {
      const passwordHash = await bcrypt.hash(current, 4);
      const limit = vi.fn().mockResolvedValue([{ passwordHash }]);
      const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      const tx = {
        update: vi.fn().mockReturnValue({ set }),
        delete: vi.fn().mockReturnValue({ where: deleteWhere }),
      };
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit }) }),
        }),
        transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
      };
      return { svc: new AuthService(db as never), db, set, deleteWhere };
    }

    it('saves a new hash and signs out the other sessions', async () => {
      const { svc, set, deleteWhere } = await setup();
      expect(await svc.changePassword('u1', 'old-password', 'new-password', 'tok')).toBe(true);
      const saved = set.mock.calls[0]![0] as { passwordHash: string };
      expect(await bcrypt.compare('new-password', saved.passwordHash)).toBe(true);
      expect(deleteWhere).toHaveBeenCalledTimes(1);
    });

    it('changes nothing when the current password is wrong', async () => {
      const { svc, db } = await setup();
      expect(await svc.changePassword('u1', 'guess', 'new-password', 'tok')).toBe(false);
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    async function setup(shared: { name: string }[]) {
      const passwordHash = await bcrypt.hash('password123', 4);
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      const orderBy = vi.fn().mockResolvedValue(shared);
      const tx = {
        selectDistinct: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({ orderBy }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: deleteWhere }),
      };
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ passwordHash }]),
            }),
          }),
        }),
        transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      };
      return { svc: new AuthService(db as never), db, deleteWhere };
    }

    it('deletes the member when no property they own has others in it', async () => {
      const { svc, deleteWhere } = await setup([]);
      expect(await svc.deleteAccount('u1', 'password123')).toEqual({ deleted: true });
      expect(deleteWhere).toHaveBeenCalledTimes(1);
    });

    it('names the shared properties and deletes nothing', async () => {
      const { svc, deleteWhere } = await setup([{ name: 'Allotment' }, { name: 'Home' }]);
      expect(await svc.deleteAccount('u1', 'password123')).toEqual({
        deleted: false,
        reason: 'shared-properties',
        properties: ['Allotment', 'Home'],
      });
      expect(deleteWhere).not.toHaveBeenCalled();
    });

    it('refuses a wrong password before looking further', async () => {
      const { svc, db } = await setup([]);
      expect(await svc.deleteAccount('u1', 'guess')).toEqual({
        deleted: false,
        reason: 'wrong-password',
      });
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });

  describe('password reset', () => {
    it('makes a link only for a known address, replacing any earlier one', async () => {
      const limit = vi.fn().mockResolvedValueOnce([{ id: 'u1', email: 'a@example.com' }]);
      const values = vi.fn().mockResolvedValue(undefined);
      const removed = vi.fn().mockResolvedValue(undefined);
      const tx = {
        delete: vi.fn().mockReturnValue({ where: removed }),
        insert: vi.fn().mockReturnValue({ values }),
      };
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit }) }),
        }),
        transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
      };
      const svc = new AuthService(db as never);
      const reset = await svc.createPasswordReset(' A@Example.com ');
      expect(reset?.email).toBe('a@example.com');
      expect(reset?.token).toMatch(/^[0-9a-f]{64}$/);
      expect(removed).toHaveBeenCalledTimes(1);
      const row = values.mock.calls[0]![0] as { tokenHash: string; expiresAt: Date };
      // Only the hash is stored, and it expires within the hour.
      expect(row.tokenHash).not.toBe(reset?.token);
      expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(RESET_LINK_MS);

      limit.mockResolvedValueOnce([]);
      expect(await svc.createPasswordReset('nobody@example.com')).toBeNull();
    });

    function resetDb(found: { userId: string }[]) {
      const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      const sessionsGone = vi.fn().mockResolvedValue(undefined);
      const tx = {
        delete: vi
          .fn()
          .mockReturnValueOnce({
            where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(found) }),
          })
          .mockReturnValueOnce({ where: sessionsGone }),
        update: vi.fn().mockReturnValue({ set }),
      };
      const db = { transaction: vi.fn(async (fn: (t: typeof tx) => Promise<boolean>) => fn(tx)) };
      return { svc: new AuthService(db as never), set, sessionsGone };
    }

    it('sets the new password and signs out every session', async () => {
      const { svc, set, sessionsGone } = resetDb([{ userId: 'u1' }]);
      expect(await svc.resetPassword('a'.repeat(64), 'new-password-1')).toBe(true);
      const saved = set.mock.calls[0]![0] as { passwordHash: string };
      expect(await bcrypt.compare('new-password-1', saved.passwordHash)).toBe(true);
      expect(sessionsGone).toHaveBeenCalledTimes(1);
    });

    it('changes nothing for an unknown, used, or expired link', async () => {
      const { svc, set } = resetDb([]);
      expect(await svc.resetPassword('b'.repeat(64), 'new-password-1')).toBe(false);
      expect(set).not.toHaveBeenCalled();
    });
  });
});
