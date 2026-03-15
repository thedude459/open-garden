---
description: "Use when editing React, TypeScript, TSX, CSS, planner UI, calendar UI, garden layout, bed planner, crop picker, or frontend fetch flows in frontend/src. Covers the single-file app structure, inline domain types, and layout conventions."
name: "Garden Frontend"
applyTo: "frontend/src/**/*.{ts,tsx,css}"
---

# Frontend Guidelines

- Keep frontend work centered in [frontend/src/App.tsx](/Users/matthewsavage/projects/garden-app/frontend/src/App.tsx) unless the task clearly requires splitting code out.
- Preserve the existing pattern of inline TypeScript domain types and straightforward `fetch`-based API calls. Do not add a state-management library.
- Prefer extending existing planner, calendar, and weather/task flows over introducing disconnected screens.
- When adding UI controls, keep the planner dense and responsive. Favor grid and flex changes in [frontend/src/styles.css](/Users/matthewsavage/projects/garden-app/frontend/src/styles.css) over ad hoc inline layout fixes.
- For crop selection or planner interactions, preserve keyboard accessibility and clear visual selection states.
- Keep destructive actions explicit and confirmed in the UI.
- If frontend API payloads change, make the corresponding backend schema and route updates rather than patching around mismatches in the client.
