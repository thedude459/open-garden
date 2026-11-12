import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NotificationRepository } from './notification-repository';
import { createTestDb, insertUser, type TestDb } from './test-db';

let t: TestDb;
let repo: NotificationRepository;
beforeAll(async () => {
  t = await createTestDb();
  repo = new NotificationRepository(t.db);
});
afterAll(() => t.close());

const device = (endpoint: string) => ({ endpoint, p256dh: 'key', auth: 'secret' });

describe('NotificationRepository', () => {
  it('stores the email setting and push devices, and lists only members who want reminders', async () => {
    const ann = await insertUser(t.db);
    const bo = await insertUser(t.db);
    await insertUser(t.db); // wants nothing
    expect(await repo.settings(ann.id)).toEqual({ emailDigest: false, pushDevices: 0 });

    await repo.setEmailDigest(ann.id, true);
    await repo.addPush(bo.id, device('https://push.example/bo-phone'));
    await repo.addPush(bo.id, device('https://push.example/bo-laptop'));
    // The same endpoint again only updates it.
    await repo.addPush(bo.id, { ...device('https://push.example/bo-phone'), auth: 'new' });
    expect(await repo.settings(bo.id)).toEqual({ emailDigest: false, pushDevices: 2 });

    const recipients = await repo.recipients();
    const byUser = new Map(recipients.map((r) => [r.userId, r]));
    expect(byUser.get(ann.id)).toMatchObject({ emailDigest: true, push: [] });
    expect(
      byUser
        .get(bo.id)
        ?.push.map((p) => [p.endpoint, p.auth])
        .sort(),
    ).toEqual([
      ['https://push.example/bo-laptop', 'secret'],
      ['https://push.example/bo-phone', 'new'],
    ]);
    expect(recipients.every((r) => r.userId === ann.id || r.userId === bo.id)).toBe(true);

    // Only the owner can remove their device; a gone device is removed outright.
    await repo.removePushForUser(ann.id, 'https://push.example/bo-phone');
    expect((await repo.settings(bo.id)).pushDevices).toBe(2);
    await repo.removePushForUser(bo.id, 'https://push.example/bo-phone');
    await repo.removePush('https://push.example/bo-laptop');
    expect((await repo.settings(bo.id)).pushDevices).toBe(0);
  });

  it('moves a browser to whoever signs in on it next', async () => {
    const ann = await insertUser(t.db);
    const bo = await insertUser(t.db);
    await repo.addPush(ann.id, device('https://push.example/shared'));
    await repo.addPush(bo.id, device('https://push.example/shared'));
    expect((await repo.settings(ann.id)).pushDevices).toBe(0);
    expect((await repo.settings(bo.id)).pushDevices).toBe(1);
  });

  it('claims a day once per member and channel, and can give it back', async () => {
    const ann = await insertUser(t.db);
    expect(await repo.claim(ann.id, 'email', '2026-06-01')).toBe(true);
    expect(await repo.claim(ann.id, 'email', '2026-06-01')).toBe(false);
    expect(await repo.claim(ann.id, 'push', '2026-06-01')).toBe(true);
    await repo.release(ann.id, 'email', '2026-06-01');
    expect(await repo.claim(ann.id, 'email', '2026-06-01')).toBe(true);
  });
});
