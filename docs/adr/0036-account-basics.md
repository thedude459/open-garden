# ADR 0036: Account basics — change password, delete account, reset links

## Status

Accepted.

## Context

A member could register, sign in, and sign out, but not change a password,
recover a forgotten one, or leave for good (Phase 4 item 17). The install is
self-hosted for a household and a few friends: SMTP is optional, email
addresses are not verified ("Admin account" in `docs/deploy.md`),
and a property's owner link cascades, so deleting a user row deletes every
property they own, shared or not.

## Decision

1. **Change password** (`PUT /api/account/password`): the current password,
   then a new one of at least 8 characters. The change and the deletion of
   every *other* session of the member run in one transaction; the session
   making the change stays signed in. A wrong current password is a 400, not
   a 401, so the web app does not read it as a lapsed session. Five wrong
   passwords in 15 minutes pause changes and deletion for that member, per
   API process, like the sign-in limits.
2. **Delete account** (`DELETE /api/account`, with the password): deletes the
   user; their sessions, memberships, reset links, and the properties only they
   belong to go through the existing cascades. While they own a property
   anyone else belongs to, it is refused with 409 and a message naming those
   properties: they transfer ownership in Settings or delete the property
   first. The check and the delete share a transaction. No soft delete or
   grace period: at household scale an owner who regrets it registers again.
3. **Reset links.** A link holds 32 random bytes as hex; only its SHA-256 is
   stored, in `password_resets` (migration 0016). It works once and for an
   hour; making a new link for an account deletes the earlier ones. Using it
   sets the password and ends every session of the account.
   - **By email** when SMTP *and* `APP_URL` are set (the link needs the app's
     public address; it is never taken from the request's Host header).
     `GET /api/auth/password-reset` tells the sign-in page whether to offer
     "Forgot password?". `POST /api/auth/password-reset` answers 204 whether
     or not the address has an account, and sends in the background, so
     neither the answer nor its timing reveals which addresses are
     registered. Three requests per address and the shared 30 per IP in 15
     minutes.
   - **By the operator** otherwise (or when the email does not arrive):
     `docker compose exec api node dist/reset-link.js person@example.com`
     prints the link, which the operator passes on. The command runs with the
     server's own database access, so it needs no admin role in the app.

## Consequences

- Without SMTP, forgotten passwords go through whoever runs the server, which
  matches who can already read the database.
- Rate limits are in memory per API process; a restart clears them. Fine for
  one container; several would need a shared store.
- The reset email is plain text, English only, like the reminder email.
- Changing the password or using a link signs out devices; a member who
  suspects someone else has their session can end it that way.
