# Security policy

## Supported versions

Open Garden is pre-1.0. Security fixes go to the `main` branch and the latest
release only. Please upgrade before reporting an issue against an older
version.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub: open the repository's **Security** tab and
choose **Report a vulnerability**
(<https://github.com/thedude459/open-garden/security/advisories/new>).

Include what you can of:

- the affected version or commit
- what an attacker can do, and what they need first (an account, network access, …)
- steps or a request that reproduces it
- any suggested fix

## What to expect

- An acknowledgement within 7 days.
- An assessment and a plan (fix, mitigation, or why it is not a vulnerability)
  within 30 days.
- Credit in the advisory and release notes, unless you prefer not to be named.

We will coordinate a disclosure date with you once a fix is available.

## Scope

In scope: the API, the web app, the Docker images and Compose files in this
repository, and their default configuration.

Out of scope: problems that need an operator to weaken the documented setup
(for example a reused `SESSION_SECRET`, demo users left enabled in production,
or exposing Postgres to the internet), and vulnerabilities in dependencies that
are already tracked by an upstream advisory — Dependabot picks those up.
