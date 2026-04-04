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
- Prefer small, single-purpose modules. If a component/hook grows beyond roughly 150-200 lines or mixes unrelated concerns, split it.
- Treat JSX sections over roughly 50 lines that represent a distinct concern (auth, nav, hero, sidebars, forms, modals) as extraction candidates into `frontend/src/features/**` or `frontend/src/components/`.
- Treat section/component prop surfaces above roughly 12-15 props as a refactor trigger. Prefer feature context providers or focused action/state objects over prop drilling.
- Keep reusable feature entry components near their domain (for example `frontend/src/features/auth/AuthScreen.tsx` and `frontend/src/features/home/*.tsx`) and keep globally shared primitives in `frontend/src/components/`.
- Extract repeated page guard lists or routing constants (for example garden-required pages) to module-level constants instead of duplicating inline arrays.
- Preserve the existing pattern of inline TypeScript domain types and straightforward `fetch`-based API calls. Do not add a state-management library.
- Avoid new `any` in app/feature code. Use domain types from `frontend/src/features/types.ts` or narrow to `unknown` with explicit checks.
- Prefer extending existing planner, calendar, and weather/task flows over introducing disconnected screens.
- When adding UI controls, keep the planner dense and responsive. Favor grid and flex changes in `frontend/src/styles.css` over ad hoc inline layout fixes.
- For crop selection or planner interactions, preserve keyboard accessibility and clear visual selection states.
- Keep destructive actions explicit and confirmed in the UI.
- If frontend API payloads change, make the corresponding backend schema and route updates rather than patching around mismatches in the client.
- For every new frontend feature or behavior change, add or update unit tests in `frontend/src/**/*.test.{ts,tsx}` and keep frontend coverage at or above 90%.
- For new context providers, add at least one provider-section integration test that renders the section inside its provider and verifies core wiring.
- Before merging frontend architecture changes, run `npm run test:unit` and `npm run build` in `frontend/`.
