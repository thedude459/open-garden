// The three guards that decide who reaches a route: signed in, admin, and a
// member of the property in the URL. A non-member gets 404, not 403, so the
// API never confirms that someone else's property exists.
import { HttpException, type ExecutionContext } from '@nestjs/common';
import type { AuthService, AuthUser } from '@open-garden/auth';
import { GardenMembershipRepository, type AppDatabase } from '@open-garden/plant-catalog-data';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminGuard } from '../admin/admin.guard';
import { GARDEN_MEMBERSHIP, GardenMembershipGuard } from '../gardens/garden-membership.guard';
import { CURRENT_USER, SessionGuard } from './session.guard';

type Req = Record<string, unknown>;
const contextFor = (req: Req) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;
const user = (role: AuthUser['role'] = 'user') =>
  ({ id: 'u1', email: 'a@example.com', role }) as AuthUser;

// HTTP status for Nest exceptions; the code for domain errors, which the
// exception filter maps to a status.
async function statusOf(run: () => unknown): Promise<number | string | undefined> {
  try {
    await run();
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : (e as { code?: string }).code;
  }
  return undefined;
}

describe('SessionGuard', () => {
  const guardWith = (resolved: AuthUser | null) => {
    const auth = { resolveSession: vi.fn().mockResolvedValue(resolved) };
    return { auth, guard: new SessionGuard(auth as unknown as AuthService) };
  };

  it('rejects a request without a session cookie, without looking it up', async () => {
    const { auth, guard } = guardWith(user());
    expect(await statusOf(() => guard.canActivate(contextFor({ cookies: {} })))).toBe(401);
    expect(await statusOf(() => guard.canActivate(contextFor({})))).toBe(401);
    expect(auth.resolveSession).not.toHaveBeenCalled();
  });

  it('rejects an unknown or expired session', async () => {
    const { guard } = guardWith(null);
    const req = { cookies: { og_session: 'stale' } };
    expect(await statusOf(() => guard.canActivate(contextFor(req)))).toBe(401);
    expect(req).not.toHaveProperty(CURRENT_USER);
  });

  it('attaches the signed-in user to the request', async () => {
    const { auth, guard } = guardWith(user());
    const req: Req = { cookies: { og_session: 'good' } };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(auth.resolveSession).toHaveBeenCalledWith('good');
    expect(req[CURRENT_USER]).toMatchObject({ id: 'u1' });
  });
});

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('lets an admin through', () => {
    expect(guard.canActivate(contextFor({ [CURRENT_USER]: user('admin') }))).toBe(true);
  });

  it('refuses ordinary users and anonymous requests', async () => {
    expect(await statusOf(() => guard.canActivate(contextFor({ [CURRENT_USER]: user() })))).toBe(
      'FORBIDDEN',
    );
    expect(await statusOf(() => guard.canActivate(contextFor({})))).toBe('FORBIDDEN');
  });
});

describe('GardenMembershipGuard', () => {
  afterEach(() => vi.restoreAllMocks());
  const guard = new GardenMembershipGuard({ db: {} as AppDatabase });
  const membership = (role: string) =>
    vi
      .spyOn(GardenMembershipRepository.prototype, 'get')
      .mockResolvedValue(
        role ? ({ gardenId: 'g1', userId: 'u1', role } as never) : (null as never),
      );

  it('records the member’s role for the route handler', async () => {
    const get = membership('viewer');
    const req: Req = { [CURRENT_USER]: user(), params: { id: 'g1' } };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(get).toHaveBeenCalledWith('g1', 'u1');
    expect(req[GARDEN_MEMBERSHIP]).toEqual({ gardenId: 'g1', userId: 'u1', role: 'viewer' });
  });

  it('answers 404 to a non-member, as if the property did not exist', async () => {
    membership('');
    const req: Req = { [CURRENT_USER]: user(), params: { id: 'g1' } };
    expect(await statusOf(() => guard.canActivate(contextFor(req)))).toBe(404);
    expect(req).not.toHaveProperty(GARDEN_MEMBERSHIP);
  });

  it('does nothing on routes without a property id or before sign-in', async () => {
    const get = membership('owner');
    await expect(
      guard.canActivate(contextFor({ [CURRENT_USER]: user(), params: {} })),
    ).resolves.toBe(true);
    await expect(guard.canActivate(contextFor({ params: { id: 'g1' } }))).resolves.toBe(true);
    expect(get).not.toHaveBeenCalled();
  });
});
