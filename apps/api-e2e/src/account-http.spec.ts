import { execFileSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { fixturePlace } from './fixture-place';
import { liveEnabled, LiveClient, uniqueEmail } from './live-http';

describe.skipIf(!liveEnabled)('account http', () => {
  test('a member switches to metric and signing in again keeps it', async () => {
    const request = new LiveClient();
    const email = `units-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const registered = await request.post('/api/auth/register', {
      data: { email, password: 'password123' },
    });
    expect(((await registered.json()) as { user: { units: string } }).user.units).toBe('imperial');

    expect((await request.put('/api/account/units', { data: { units: 'metric' } })).status()).toBe(
      204,
    );
    expect((await request.put('/api/account/units', { data: { units: 'cubits' } })).status()).toBe(
      400,
    );

    const again = await new LiveClient().post('/api/auth/login', {
      data: { email, password: 'password123' },
    });
    expect(((await again.json()) as { user: { units: string } }).user.units).toBe('metric');
  });

  test('units need a session', async () => {
    const res = await new LiveClient().put('/api/account/units', { data: { units: 'metric' } });
    expect(res.status()).toBe(401);
  });

  test('changing the password signs out every other session', async () => {
    const email = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const here = new LiveClient();
    await here.post('/api/auth/register', { data: { email, password: 'password123' } });
    const elsewhere = new LiveClient();
    await elsewhere.post('/api/auth/login', { data: { email, password: 'password123' } });
    expect((await elsewhere.get('/api/gardens')).status()).toBe(200);

    const wrong = await here.put('/api/account/password', {
      data: { currentPassword: 'not-it', newPassword: 'new-password-1' },
    });
    expect(wrong.status()).toBe(400);
    expect(await wrong.text()).toContain('current password is not right');
    const short = await here.put('/api/account/password', {
      data: { currentPassword: 'password123', newPassword: 'short' },
    });
    expect(short.status()).toBe(400);

    const changed = await here.put('/api/account/password', {
      data: { currentPassword: 'password123', newPassword: 'new-password-1' },
    });
    expect(changed.status()).toBe(204);
    expect((await here.get('/api/gardens')).status()).toBe(200);
    expect((await elsewhere.get('/api/gardens')).status()).toBe(401);

    const old = await new LiveClient().post('/api/auth/login', {
      data: { email, password: 'password123' },
    });
    expect(old.status()).toBe(401);
    const fresh = await new LiveClient().post('/api/auth/login', {
      data: { email, password: 'new-password-1' },
    });
    expect(fresh.status()).toBe(200);
  });

  test('five wrong current passwords pause password changes', async () => {
    const email = `pw-limit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const request = new LiveClient();
    await request.post('/api/auth/register', { data: { email, password: 'password123' } });
    const attempt = (currentPassword: string) =>
      request.put('/api/account/password', {
        data: { currentPassword, newPassword: 'new-password-1' },
      });
    for (let i = 0; i < 5; i++) expect((await attempt('guess')).status()).toBe(400);
    const limited = await attempt('password123');
    expect(limited.status()).toBe(429);
    expect(await limited.text()).toContain('Too many attempts');
  });

  test('a password change needs a session', async () => {
    const res = await new LiveClient().put('/api/account/password', {
      data: { currentPassword: 'password123', newPassword: 'new-password-1' },
    });
    expect(res.status()).toBe(401);
  });

  test('deleting an account signs it out for good and takes its own property', async () => {
    const me = new LiveClient();
    const email = uniqueEmail('delete-solo');
    await me.register(email);
    const created = await me.post('/api/gardens', {
      data: { place: fixturePlace, name: 'Solo plot' },
    });
    expect(created.status()).toBe(201);

    const wrong = await me.delete('/api/account', { data: { password: 'not-it' } });
    expect(wrong.status()).toBe(400);
    expect(await wrong.text()).toContain('password is not right');

    expect((await me.delete('/api/account', { data: { password: 'password123' } })).status()).toBe(
      204,
    );
    expect((await me.get('/api/gardens')).status()).toBe(401);
    const again = await new LiveClient().post('/api/auth/login', {
      data: { email, password: 'password123' },
    });
    expect(again.status()).toBe(401);
  });

  test('an owner of a shared property cannot delete their account until it is handed over', async () => {
    const owner = new LiveClient();
    const friend = new LiveClient();
    await owner.register(uniqueEmail('delete-owner'));
    const friendUser = await friend.register(uniqueEmail('delete-friend'));
    const garden = (await (
      await owner.post('/api/gardens', { data: { place: fixturePlace, name: 'Shared plot' } })
    ).json()) as { id: string };
    expect(
      (
        await owner.post(`/api/gardens/${garden.id}/members`, {
          data: { email: friendUser.email, role: 'collaborator' },
        })
      ).status(),
    ).toBe(201);

    const refused = await owner.delete('/api/account', { data: { password: 'password123' } });
    expect(refused.status()).toBe(409);
    expect(await refused.text()).toContain('Others belong to Shared plot');
    expect((await owner.get(`/api/gardens/${garden.id}`)).status()).toBe(200);

    // A member who does not own it leaves with their account; the property stays.
    expect(
      (await friend.delete('/api/account', { data: { password: 'password123' } })).status(),
    ).toBe(204);
    const members = (await (await owner.get(`/api/gardens/${garden.id}/members`)).json()) as {
      members: { email: string }[];
    };
    expect(members.members.map((m) => m.email)).not.toContain(friendUser.email);

    expect(
      (await owner.delete('/api/account', { data: { password: 'password123' } })).status(),
    ).toBe(204);
  });

  test('without SMTP, a reset link comes from the reset-link command and works once', async () => {
    const options = await new LiveClient().get('/api/auth/password-reset');
    expect(await options.json()).toEqual({ byEmail: false });
    const byEmail = await new LiveClient().post('/api/auth/password-reset', {
      data: { email: 'someone@example.com' },
    });
    expect(byEmail.status()).toBe(404);

    const email = uniqueEmail('reset');
    const me = new LiveClient();
    await me.register(email);
    // The command the README gives operators, from the bundle the image ships.
    const out = execFileSync('node', ['dist/api-runtime/reset-link.js', email], {
      encoding: 'utf8',
    });
    const token = /reset-password\?token=([0-9a-f]{64})/.exec(out)?.[1];
    expect(token, out).toBeTruthy();

    const short = await new LiveClient().post('/api/auth/password-reset/confirm', {
      data: { token, password: 'short' },
    });
    expect(short.status()).toBe(400);
    const done = await new LiveClient().post('/api/auth/password-reset/confirm', {
      data: { token, password: 'reset-password-1' },
    });
    expect(done.status()).toBe(204);
    expect((await me.get('/api/gardens')).status()).toBe(401);
    expect((await new LiveClient().login(email, 'reset-password-1')).email).toBe(email);

    const again = await new LiveClient().post('/api/auth/password-reset/confirm', {
      data: { token, password: 'reset-password-2' },
    });
    expect(again.status()).toBe(400);
    expect(await again.text()).toContain('expired or was already used');
  });

  test('the reset-link command says when no account has the address', () => {
    let failed: { status?: number; stderr?: string } = {};
    try {
      execFileSync('node', ['dist/api-runtime/reset-link.js', uniqueEmail('nobody')], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err) {
      failed = err as typeof failed;
    }
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain('No account uses');
  });
});
