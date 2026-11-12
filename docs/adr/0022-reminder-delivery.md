# ADR 0022: Reminder delivery by web push and a daily email

## Status

Accepted

## Context

Care reminders and the Today home only worked inside the app: a household
had to open it to learn that the tomatoes needed water. Phase 4 item 2 asks
for web push (opt-in per member) and an optional daily email digest. The app
is self-hosted, often on one small machine, with no job queue and no
outside services required.

## Decision

1. **One daily run, in the API process.** `ReminderScheduler` checks every
   ten minutes and, once the server's local hour reaches `REMINDER_HOUR`
   (default 7), sends the day's reminders. No queue, no cron container. The
   hour is the server's time zone (`TZ`); properties have no time zone of
   their own yet.
2. **No duplicates, by claim.** `reminder_deliveries` has one row per member,
   channel, and day. A send first inserts that row (`on conflict do
   nothing`); only the call that inserts it sends. A failed send deletes the
   row so a later tick retries. Restarts and several API instances therefore
   send at most one push and one email per member per day.
3. **What is sent is Today.** `libs/reminder-delivery` builds the same task
   list the Today page shows (`todayFor`, moved out of the controller), so
   the page and the message never disagree. Push lists due and overdue care
   only; the email also lists crops to start this week. Overdue tasks are
   listed again the next day until they are done.
4. **Web push with VAPID.** The `web-push` library signs and encrypts
   messages. Keys come from `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`; push
   is off unless both are set. A member turns push on per device from the
   Today page; the Angular service worker shows the notification and opens
   `/today` when it is tapped. A device the push service reports as gone
   (404/410) is deleted.
5. **Email over SMTP with nodemailer.** Off unless `SMTP_HOST` and
   `SMTP_FROM` are set. Each member turns the daily summary on or off on the
   Today page; it is off by default. Plain text only.
6. **Endpoints are checked.** A push endpoint is a URL the server will POST
   to, so it must be `https` on a known push service host (Google, Mozilla,
   Apple, Windows); anything else is refused. Keys are bounded base64url.
7. **Settings belong to the member, not the property**, so they sit on the
   Today page (which spans properties), not on a property's Settings page.

## Consequences

+ Reminders reach people without anything beyond the API and Postgres; an
  install with neither keys nor SMTP behaves exactly as before.
+ Senders sit behind small interfaces, so the delivery rules are tested with
  stubs and the real senders against a fake SMTP server and the library's
  own request builder.
- One time for everyone: a member in another time zone than the server gets
  reminders at the server's hour. Per-property time zones would fix this.
- A push service outside the allowlist (a self-hosted one) is refused until
  it is added to `PUSH_SERVICE_HOSTS`.
- Each tick after the hour rebuilds Today for every recipient, sent or not.
  Cheap for a household; marked in the scheduler for larger installs.
