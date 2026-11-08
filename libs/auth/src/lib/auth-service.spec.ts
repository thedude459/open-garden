import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthService, EMAIL_TAKEN_MESSAGE } from './auth-service';

describe('AuthService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a user', async () => {
    const returning = vi.fn().mockResolvedValue([
      { id: 'u1', email: 'a@example.com', displayName: 'A', role: 'user' },
    ]);
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
    });
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
    };
    const svc = new AuthService(db as never);
    const result = await svc.login('a@example.com', 'password123');
    expect(result?.user.id).toBe('u1');
    expect(result?.token).toHaveLength(64);
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
});
