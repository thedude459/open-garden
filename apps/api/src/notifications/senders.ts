import nodemailer from 'nodemailer';
import webpush from 'web-push';
import type {
  EmailSender,
  PushSender,
  PushSubscriptionRecord,
} from '@open-garden/reminder-delivery';
import type { NotificationConfig } from './notification-config';

/** Web push through the browser's push service, signed with the VAPID keys. */
export function webPushSender(push: NonNullable<NotificationConfig['push']>): PushSender {
  const details = {
    subject: push.subject,
    publicKey: push.publicKey,
    privateKey: push.privateKey,
  };
  return {
    async send(subscription: PushSubscriptionRecord, payload: string) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { vapidDetails: details, TTL: 12 * 60 * 60 },
        );
        return 'sent';
      } catch (err) {
        // 404 and 410: the browser dropped the subscription.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return 'gone';
        throw err;
      }
    },
  };
}

/** Email over SMTP; port 465 uses TLS from the start, others upgrade with STARTTLS. */
export function smtpEmailSender(smtp: NonNullable<NotificationConfig['smtp']>): EmailSender {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.password ?? '' } } : {}),
  });
  return {
    async send(to: string, subject: string, text: string) {
      await transport.sendMail({ from: smtp.from, to, subject, text });
    },
  };
}
