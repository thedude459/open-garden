import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { webPushSender } from './senders';

// A browser's subscription keys: a P-256 public key and a 16-byte secret.
const browser = createECDH('prime256v1');
browser.generateKeys();
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/device',
  p256dh: browser.getPublicKey('base64url'),
  auth: randomBytes(16).toString('base64url'),
};
const vapid = webpush.generateVAPIDKeys();
const sender = webPushSender({ ...vapid, subject: 'mailto:test@example.com' });

afterEach(() => vi.restoreAllMocks());

describe('webPushSender', () => {
  it('builds an encrypted, VAPID-signed request for the device', async () => {
    const send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });
    expect(await sender.send(subscription, '{"notification":{"title":"Hi"}}')).toBe('sent');
    const [target, payload, options] = send.mock.calls[0]!;
    expect(target).toEqual({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    });
    // What web-push would put on the wire with exactly these arguments.
    const request = webpush.generateRequestDetails(target, payload, options);
    expect(request.endpoint).toBe(subscription.endpoint);
    expect(request.headers['Content-Encoding']).toBe('aes128gcm');
    expect(String(request.headers['Authorization'])).toMatch(/^vapid t=.+, k=/);
    expect(request.headers['TTL']).toBe(12 * 60 * 60);
    expect(request.body?.length).toBeGreaterThan(0);
  });

  it('reports a subscription the push service has dropped, and throws on other errors', async () => {
    const send = vi.spyOn(webpush, 'sendNotification');
    for (const statusCode of [410, 404]) {
      send.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode }));
      expect(await sender.send(subscription, '{}')).toBe('gone');
    }
    send.mockRejectedValueOnce(Object.assign(new Error('server'), { statusCode: 500 }));
    await expect(sender.send(subscription, '{}')).rejects.toThrow('server');
  });
});

describe('smtpEmailSender', () => {
  it('delivers the message to the SMTP server with the configured sender', async () => {
    const { createServer } = await import('node:net');
    let message = '';
    const commands: string[] = [];
    // Just enough SMTP to accept one message.
    const server = createServer((socket) => {
      let inData = false;
      socket.write('220 test ESMTP\r\n');
      socket.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split('\r\n')) {
          if (inData) {
            if (line === '.') {
              inData = false;
              socket.write('250 queued\r\n');
            } else message += line + '\n';
            continue;
          }
          if (!line) continue;
          commands.push(line.split(' ')[0]!.toUpperCase());
          if (/^(EHLO|HELO)/i.test(line)) socket.write('250 test\r\n');
          else if (/^DATA/i.test(line)) {
            inData = true;
            socket.write('354 go\r\n');
          } else if (/^QUIT/i.test(line)) socket.end('221 bye\r\n');
          else socket.write('250 ok\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const { smtpEmailSender } = await import('./senders');
    try {
      await smtpEmailSender({
        host: '127.0.0.1',
        port,
        user: undefined,
        password: undefined,
        from: 'garden@example.com',
      }).send('ann@example.com', 'Open Garden: 1 task today', 'Home\n- Water Basil');
    } finally {
      server.close();
    }
    expect(commands).toEqual(expect.arrayContaining(['EHLO', 'MAIL', 'RCPT', 'DATA']));
    expect(message).toContain('From: garden@example.com');
    expect(message).toContain('To: ann@example.com');
    expect(message).toContain('Subject: Open Garden: 1 task today');
    expect(message).toContain('- Water Basil');
  });
});
