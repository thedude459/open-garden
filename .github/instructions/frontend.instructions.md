---
description: "Use when editing React, TypeScript, TSX, CSS, planner UI, calendar UI, garden layout, bed planner, crop picker, or frontend fetch flows in frontend/src. Covers the single-file app structure, inline domain types, and layout conventions."
name: "Garden Frontend"
applyTo: "frontend/src/**/*.{ts,tsx,css}"
---

# Frontend Guidelines

- Keep `frontend/src/App.tsx` as a composition shell. Prefer putting reusable logic in `frontend/src/features/app/hooks/`, feature-specific logic in `frontend/src/features/**`, and shared UI in `frontend/src/components/`.
- Keep `frontend/src/App.tsx` focused on top-level orchestration: page routing state, global modals/toasts, and wiring props into feature panels.
- Reuse app-level hooks (`useAuthFlow`, `useAuthedFetch`, `useNotices`, `usePlannerHistory`) instead of re-implementing auth, request handling, toasts, or planner history inside page components.
- Use hook namespaces in `App.tsx` when a hook returns many values (for example `taskActions`, `gardenActions`, `cropFormState`, `plannerActions`) instead of flattening everything into one large destructuring block.
- When adding new behavior, avoid adding more orchestration to `App.tsx` if the logic can live in a focused hook or feature module.
- Keep per-hook scope narrow. If a hook owns unrelated domains (for example core entities + insights + sync), split into domain hooks and compose them from a thin orchestrator.
- Keep effect dependencies stable. Do not place whole hook return objects in dependency arrays when only specific callbacks/state are needed; destructure stable callbacks and depend on those members.
- Memoize error-handler factories and callback helpers that are passed into `useEffect` dependencies (for example `noticeUnlessExpired`) to avoid accidental refetch loops.
- Prefer small, single-purpose modules. If a component/hook grows beyond roughly 150-200 lines or mixes unrelated concerns, split it.
- Treat JSX sections over roughly 50 lines that represent a distinct concern (auth, nav, hero, sidebars, forms, modals) as extraction candidates into `frontend/src/features/**` or `frontend/src/components/`.
- Treat section/component prop surfaces above roughly 12-15 props as a refactor trigger. Prefer feature context providers or focused action/state objects over prop drilling.
- For top-level composition boundaries (for example `App.tsx` -> page router), group props into domain objects (`routing`, `shell`, `garden`, `insights`, etc.) rather than passing dozens of flat props.
- Keep reusable feature entry components near their domain (for example `frontend/src/features/auth/AuthScreen.tsx` and `frontend/src/features/home/*.tsx`) and keep globally shared primitives in `frontend/src/components/`.
- Extract repeated page guard lists or routing constants (for example garden-required pages) to module-level constants instead of duplicating inline arrays.
- Preserve the existing pattern of inline TypeScript domain types and straightforward `fetch`-based API calls. Do not add a state-management library.
- Avoid new `any` in app/feature code. Use domain types from `frontend/src/features/types.ts` or narrow to `unknown` with explicit checks.
- Prefer extending existing planner, calendar, and weather/task flows over introducing disconnected screens.
- Keep planner feature internals split by concern (crop visuals, selection state, geometry, rotation preview, overlays). Avoid monolithic planner components that combine all interaction domains in one file.
- Organise large feature directories into subdirectories by concern rather than keeping everything flat. Use `app/` as the reference model: `hooks/` for React hooks, `utils/` for pure helpers, and named subdirs for grouped UI components (e.g. `bed/`, `yard/`, `engine/`).
- The `planner/` feature follows this layout: `engine/` (pure computation: growthSim, shadeMap, sunModel, plannerGeometry, plannerUtils), `hooks/` (React hooks: usePlannerBulkSelection, usePlannerCropVisuals, usePlannerOverlayState, usePlannerRotationPreview), `bed/` (bed UI components), `yard/` (yard UI components), and root-level orchestration files (PlannerPanel, PlannerPage, PlannerContext, PlannerPlacementTools, PlannerPageSection).
- The `calendar/` feature keeps `hooks/` for custom hooks (e.g. useCalendarAgendaState) and `utils/` for pure date helpers (e.g. calendarDateUtils). Other features should follow the same pattern as they grow.
- When a feature directory exceeds roughly 8-10 files flat, add subdirectories rather than continuing to grow the flat list.
- When adding UI controls, keep the planner dense and responsive. Favor grid and flex changes in `frontend/src/styles.css` over ad hoc inline layout fixes.
- For crop selection or planner interactions, preserve keyboard accessibility and clear visual selection states.
- Keep destructive actions explicit and confirmed in the UI.
- If frontend API payloads change, make the corresponding backend schema and route updates rather than patching around mismatches in the client.
- For every new frontend feature or behavior change, add or update unit tests in `frontend/src/**/*.test.{ts,tsx}` and keep frontend coverage at or above 90% (hard floor: 80% in local and CI checks).
- Use the phased coverage rollout in `frontend/COVERAGE_ROADMAP.md` and advance coverage scope over time (`core` -> `phase1` -> `phase2` -> `full`) rather than permanently narrowing coverage includes.
- If a PR touches files in the active phase, add/adjust tests for those touched files in the same PR.
- For new context providers, add at least one provider-section integration test that renders the section inside its provider and verifies core wiring.
- Before merging frontend architecture changes, run `npm run test:unit`, the active phase coverage command from `frontend/COVERAGE_ROADMAP.md`, and `npm run build` in `frontend/`.
