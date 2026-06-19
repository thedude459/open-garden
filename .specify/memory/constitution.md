<!--
Sync Impact Report
Version change: (template) → 1.0.0
Modified principles: N/A (initial ratification)
Added sections: Purpose, Core Principles (5), Domain Requirements,
  Task Engine & User Interaction, Governance
Removed sections: None (template placeholders replaced)
Templates:
  - .specify/templates/plan-template.md — ✅ updated (Constitution Check gates)
  - .specify/templates/spec-template.md — ✅ no change required
  - .specify/templates/tasks-template.md — ✅ updated (domain task categories)
  - .specify/templates/constitution-template.md — ⚠ unchanged (generic template retained)
Follow-up TODOs: None
-->

# Garden Planning and Management System Constitution

## Purpose

This system is a garden planning and management assistant. It helps users
design, plant, track, and maintain home gardens, orchards, and permaculture
systems. It provides horticultural guidance, enforces biological constraints,
and generates dynamic task schedules based on climate, weather, plant needs, and
user-defined garden layouts.

The system acts as a garden planner, horticultural knowledge engine, task
scheduler, layout validator, permaculture advisor, and weather-aware automation
system.

## Core Principles

### I. Horticultural Knowledge Engine (NON-NEGOTIABLE)

The system MUST maintain and apply domain knowledge including frost dates,
climate-zone planting windows, indoor seed-starting timelines, transplanting and
direct-seeding rules, plant spacing, companion and incompatible relationships,
organic fertilizer guidance, watering needs by plant type and growth stage,
succession planting intervals, tree spacing by species and rootstock, permaculture
guild principles, and harvest timing with expected yields.

All scheduling, placement, and recommendation features MUST derive from this
knowledge base — not hard-coded per-screen logic.

**Rationale**: Horticultural accuracy is the product's core value. Without a
centralized knowledge engine, guidance becomes inconsistent and unreliable.

### II. Layout & Placement Validation (NON-NEGOTIABLE)

The system MUST validate every plant placement against biological constraints.
It MUST prevent incompatible companion placements, invalid tree spacing based on
species and rootstock, and overcrowding beyond biological limits. It MUST warn
when spacing rules are violated and suggest beneficial companions and understory
guild members for orchard trees.

Users MAY override non-critical warnings. The system MUST NEVER allow overrides
for incompatible companions, invalid tree spacing, or overcrowding beyond
biological limits.

**Rationale**: Invalid layouts cause crop failure and user frustration. Hard
constraints protect users from biologically harmful configurations.

### III. Weather-Aware Task Scheduling

The system MUST generate and dynamically update task schedules for watering,
fertilizing, weeding, harvesting, succession planting, and orchard care. Tasks
MUST adjust based on weather events (e.g., skip or reduce watering when rainfall
is detected). Watering frequency MUST consider plant type, growth stage, soil
type, and weather forecast.

**Rationale**: Static schedules ignore real-world conditions. Weather-aware
automation keeps recommendations timely and actionable.

### IV. Organic & Safety-First Practices (NON-NEGOTIABLE)

The system MUST prioritize organic, regenerative, and permaculture-aligned
practices. It MUST NEVER recommend harmful chemical fertilizers or pesticides.
It MUST prevent biologically impossible or harmful garden configurations.

**Rationale**: The product serves home gardeners who trust it for safe,
sustainable guidance. Recommending harmful inputs violates that trust.

### V. Persistence, State & Extensibility

The system MUST persist garden layouts, plant placements, planting dates, task
history, weather-adjusted schedules, and user preferences. Architecture MUST
support future modules including soil testing integration, pest and disease
diagnosis, yield tracking, crop rotation planning, greenhouse mode, and
hydroponic mode without breaking existing data or workflows.

**Rationale**: Garden planning spans seasons and years. Durable state and
extensible design enable long-term user investment in the system.

## Domain Requirements

### Plant Database

The system MUST support a preloaded database containing vegetables, herbs, fruits,
berries, fruit trees, nut trees, shrubs, cover crops, companion flowers, and
permaculture guild plants. Each entry MUST include:

- Botanical and common names
- Varietal information
- Days to maturity
- Indoor seed-starting window
- Transplanting and direct-seeding rules
- Spacing requirements
- Watering and fertilizer needs
- Companion and incompatible plants
- Pest and disease notes
- Harvest window
- Rootstock and mature size (for trees)

### Garden Structure & Layout

Users MUST be able to create multiple garden areas designated as Garden, Orchard,
or Mixed-use zone. Within each area, users MUST be able to define bed dimensions,
orientation, soil type, and sun exposure. The system MUST enforce spacing and
prevent overcrowding.

For orchards, the system MUST space trees by species, rootstock vigor, and
mature canopy size; provide understory recommendations based on permaculture
guild principles; and enforce understory spacing rules.

### Location & Climate Integration

The system MUST use the user's location to determine frost dates, climate zone,
rainfall events, and temperature trends. All planting windows, task schedules,
and succession suggestions MUST reflect local climate data.

## Task Engine & User Interaction

### Core Task Types

The system MUST generate and maintain schedules for:

- **Watering** — based on plant type, growth stage, soil type, and forecast;
  reduced or skipped when rainfall is detected
- **Fertilizing** — organic recommendations matched to plant, growth stage, and
  soil amendments
- **Weeding** — recurring tasks based on bed type, plant density, and season
- **Harvesting** — predicted windows from variety, planting date, and growth stage
- **Succession planting** — follow-up plantings from crop type, days to maturity,
  and local frost dates
- **Orchard care** — pruning, mulching, pest monitoring, and understory
  maintenance

### User Interaction Rules

The system MUST validate all plant placements, provide context-aware
recommendations, and clearly distinguish warnings from hard constraint violations.
Non-critical warnings MAY be overridden; biological hard limits MUST NOT.

## Spec-Driven Workflow & Quality Gates

All features MUST follow the Spec Kit workflow: constitution → specify → clarify
→ plan → tasks → implement. Implementation plans MUST include a Constitution
Check gate verifying compliance with principles I–V before research and again
after design.

Domain-specific acceptance criteria MUST be testable: placement validation,
schedule generation, weather adjustment, and knowledge-base lookups MUST have
verifiable outcomes defined in specs before implementation begins.

## Governance

This constitution supersedes ad-hoc feature decisions. All specifications,
plans, and tasks MUST verify compliance with Core Principles I–V and Domain
Requirements before implementation.

**Amendment procedure**: Propose changes via `/speckit-constitution` with explicit
rationale. Version bumps follow semantic versioning — MAJOR for principle
removals or redefinitions, MINOR for new principles or material expansions, PATCH
for clarifications. Update dependent templates (plan, spec, tasks) in the same
change.

**Compliance review**: Every `/speckit-plan` Constitution Check and every
`/speckit-analyze` run MUST flag violations of hard constraints (Principles I,
II, and IV). Complexity that bypasses validation or knowledge-engine patterns
MUST be documented in the plan's Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-06-12 | **Last Amended**: 2026-06-12
