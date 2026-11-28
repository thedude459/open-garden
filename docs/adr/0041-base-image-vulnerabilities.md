# ADR 0041: Base-image vulnerabilities, found daily and fixed fast

## Status

Accepted.

## Context

Every pull request builds both images and fails on a fixable HIGH or CRITICAL
vulnerability (AGENTS.md, "Quality & Security Gates"). In November 2026 the
web image's base, `nginx-unprivileged:stable-alpine`, carried nginx 1.30.6
with six fixed CVEs:

- The scan failed on Dependabot's pull requests from 19 November. Nobody
  noticed until a feature pull request was blocked on 22 November.
- Nothing already in place could fix it:
  - Dependabot's weekly base-image bump had nothing to offer: the stable
    image had not been rebuilt with 1.30.7.
  - The Dockerfile's daily `apk upgrade` cannot reach nginx, which comes from
    nginx.org's packages, not Alpine's.
  - The api image had no such step until #280: Debian's fixes for PAM
    waited for a rebuilt `node:24-bookworm-slim`. It now runs `apt-get
    upgrade` on the same daily date.
  - The weekly Image scan only scanned the last released images.
- The fix was a different channel of the same image, `mainline-alpine`, which
  had nginx 1.31.7 with none of them. A person had to find it.

## Decision

1. **Found the day it appears.** The Image scan workflow runs daily:
   - It scans the released images, as before.
   - It also builds both images from `main` and scans them.
   - With a finding, it opens one issue labelled `security` (or updates the
     open one) listing each vulnerability, package, and fixed version.
   - It closes that issue once both images from `main` scan clean.
2. **Fixed by the next base when one exists.** Dependabot checks the base
   images daily. A digest-only bump (the same tag, rebuilt) merges on its own
   once every required check passes, like patch and minor updates.
3. **Other allowed bases tried automatically.** `.github/base-images.json`
   lists, per image, the base tags we accept:
   - web: `mainline-alpine` and `stable-alpine`;
   - api: `24-bookworm-slim` and `24-trixie-slim`.

   When main's image has a finding, `scripts/ci/image-watch.sh` rebuilds it on
   each tag's newest digest and scans it. The issue then names a clean base
   and the exact `FROM` change, or says none is clean yet. A person makes the
   switch: a new base can change behaviour, so it is reviewed. The list stays
   short and reviewed for the same reason.
4. **Exceptions that run out.** When no allowed base is clean, a finding may
   go in `.trivyignore`. Each entry needs:
   - the tracking issue's URL in a comment above it;
   - an expiry at most 30 days ahead (`CVE-… exp:YYYY-MM-DD`).

   CI checks both (`scripts/ci/trivyignore-check.js`) and refuses an entry
   that has expired. After the date Trivy reports the finding again, so a
   pull request fails until it is fixed or the exception is renewed on
   purpose. The pull request adding an entry states the exception, as AGENTS.md
   asks.

## Consequences

- A base-image vulnerability becomes an issue the morning after it is
  published, instead of a red check on someone else's pull request days
  later.
- Most fixes need no one: Dependabot's daily digest bump merges itself.
- The scheduled job builds up to three web and two api images on a bad day.
  That costs CI minutes only when there is a finding.
- The issue suggests a switch but never makes it. Opening that pull request
  automatically would need a GitHub App or a personal token: pull requests
  opened with the workflow's own token do not run CI. Add one if switching
  bases by hand proves slow.
- The gate in AGENTS.md is unchanged: a finding still blocks merge. An
  exception is the deliberate, recorded, time-limited kind AGENTS.md allows.
