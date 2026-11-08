# ADR 0017: Retire Spec Kit

## Status

Accepted

## Context

Features 001–015 went through Spec Kit (specify → plan → tasks → implement).
The workflow added `.specify/`, `specs/` (about 1.4 MB), and roughly 35
generated skill, agent, and prompt files duplicated across `.cursor/` and
`.github/`. Year records and property areas (migrations 0011–0012) shipped
without spec folders, and the Cursor rule still pointed at spec 014. No
agent-neutral instruction file existed, so tools other than Cursor and
Copilot never read the constitution.

## Decision

1. Remove `.specify/`, `specs/`, and the generated Spec Kit skills, agents,
   prompts, and Cursor rule.
2. Keep the constitution as `AGENTS.md` (read by Cursor, Copilot, Codex, and
   others); `CLAUDE.md` imports it.
3. Plan work in pull request descriptions and `docs/roadmap.md`. Keep ADRs
   for lasting decisions.
4. Move the two spec documents still referenced by live docs to
   `docs/catalog-pipeline-checks.md` and `docs/e2e-contract.md`.

## Consequences

+ One short instruction file every coding agent reads
+ Less generated scaffolding to keep in sync
- Historical specs are only in git history (`git log -- specs/`)
- No enforced specify → plan → tasks gate; review relies on PRs and ADRs
