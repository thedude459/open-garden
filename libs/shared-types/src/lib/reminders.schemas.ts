import { z } from 'zod';

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const careKindSchema = z.enum(['water', 'fertilize', 'harvest']);

export const reminderMutationSchema = z.object({
  plantingId: uuid,
  kind: careKindSchema,
  dueOn: isoDate,
});

export const asOfQuerySchema = z.object({
  asOf: isoDate,
});

// A push service URL and the browser's keys (base64url). Bounded so a client
// cannot store arbitrary amounts of data.
const base64url = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+=*$/);

/**
 * The browsers' push services. The server sends to the endpoint a browser
 * gives it, so only these hosts are accepted; anything else could point the
 * server at an internal address.
 */
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com', // Chrome, Edge, Android
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com', // Safari
  '.notify.windows.com', // Windows (WNS)
];

export function isPushServiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port !== '') return false;
    return PUSH_SERVICE_HOSTS.some((host) =>
      host.startsWith('.') ? url.hostname.endsWith(host) : url.hostname === host,
    );
  } catch {
    return false;
  }
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(2048).refine(isPushServiceUrl, 'Not a browser push service'),
  keys: z.object({ p256dh: base64url, auth: base64url }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.url().max(2048),
});

export const emailDigestSchema = z.object({ enabled: z.boolean() });
