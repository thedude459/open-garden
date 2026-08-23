# Implementation Plan: UI Feedback & Garden Usability Polish

**Branch**: `009-ui-feedback-polish` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-ui-feedback-polish/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Give Open Garden immediate, consistent action feedback and a clearer garden map without changing APIs, membership, or planner rules (008). Technical approach: a small **pure** module `libs/web-ui` for notice queue (success auto-dismiss 4s with no Dismiss, errors/misses until dismissed, any kind replaces current) and in-flight busy keys; Angular standalone wrappers plus CSS tokens in `apps/web` (spacing scale, `.card` elevation, primary/secondary/destructive buttons). First-class screens (Overview, Bed View, Transplant View, garden home/forms, auth, catalog) wire busy + confirm. Overview adds place marker, hatch+label distinction for areas vs beds, labeled **Open bed** (click-without-drag still opens; drag still moves). Empty states offer role-appropriate next steps (empty bed: Direct seed and Transplants equal). Plantings/calendar/reminders inherit CSS only. ADR 0011. No migrations.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS API (unchanged); Angular standalone components; Vitest; Playwright; existing `@open-garden/garden-layout` (gestures unchanged)

**Storage**: No PostgreSQL or IndexedDB schema changes. Notice and busy state are in-memory for the session only.

**Testing**: Vitest (unit, ≥80% coverage CI gate) for `libs/web-ui`; Playwright E2E for busy, notices, Open bed, empty states, bed vs area labels

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo)

**Project Type**: Nx monorepo — backend API app + Angular frontend app + libs

**Performance Goals**: Busy appearance on the triggering control in under 0.5s after activate (SC-001). Success notice gone without user action at **4 seconds**. Overview 10×50 fixture timing from 008 unchanged.

**Constraints**: REST API only; no new endpoints; library-first `libs/web-ui`; no provider HTTP; membership AuthZ unchanged; online-required planner mutations unchanged (008); YAGNI — no toast vendor, no design-system package beyond tokens + 3–4 standalone pieces

**Scale/Scope**: Household UI. First-class busy/confirm on listed screens only. Plantings/calendar/reminders inherit button/notice CSS if they use `.btn` / the notice host; no action-by-action audit.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Library-First**: Notice queue + busy-key helpers in `libs/web-ui` (pure TS, Vitest). Angular pages stay thin.
- [x] **Provider Abstraction**: No plant-provider calls
- [x] **Simplicity (YAGNI)**: No new REST, no toast library, no token build pipeline. CSS variables and `.card` in existing `styles.css`. One notice at a time (any kind replaces current).
- [x] **Multi-User**: Same owner/collaborator/viewer rules; mutate busy states only on controls the role can use; viewers still get Open bed + empty explanations
- [x] **Type Safety & Shared Contracts**: No new API DTOs. Lib types stay in `libs/web-ui`. Existing `@open-garden/shared-types` unchanged.
- [x] **REST Boundary**: Unchanged Nest REST; Angular still HTTP-only
- [x] **Angular Standalone**: Notice host, place marker, empty-state as standalone components (no NgModules)
- [x] **PostgreSQL Migrations**: None (FR-014)
- [x] **Testing Gates**: Vitest `libs/web-ui`; Playwright names in `contracts/ui.md`
- [x] **Security**: No new authZ; notices must not leak other gardens’ names; no secrets
- [x] **Self-Hosted**: Existing Compose
- [x] **ADR**: [0011](../../docs/adr/0011-ui-feedback-tokens.md) (to be added at implement)

**Post-design re-check**: Still pass. Client-only entities in data-model.md are presentation state, not tables. No REST contract files beyond “none.”

## Project Structure

### Documentation (this feature)

```text
specs/009-ui-feedback-polish/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui.md
└── tasks.md                 # /speckit-tasks — not this command
```

### Source Code (repository root)

```text
apps/web/src/app/
├── ui/                      # standalone NoticeHost, PlaceMarker, EmptyState
├── auth/login.page.ts       # busy + notice
├── plants/                  # catalog busy + empty
└── gardens/                 # list, detail, overview, bed, transplants

apps/web/src/styles.css      # tokens: space, elevation, .btn-* , .empty-state, area hatch

libs/web-ui/src/lib/         # notice-queue.ts, busy-lock.ts (+ specs)
```

**Structure Decision**: Domain-free presentation helpers live in a small `libs/web-ui` so Vitest coverage counts toward the 80% gate and Angular does not own auto-dismiss rules. Visual tokens and page wiring stay in `apps/web`. Planner gesture math stays in `libs/garden-layout` (008). No `apps/api` changes.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. New Nx lib is justified: testable notice/busy rules with a public interface, not a speculative design-system framework.
