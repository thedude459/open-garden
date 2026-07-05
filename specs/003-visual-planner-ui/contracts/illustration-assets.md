# Illustration Assets Contract

**Feature**: 003-visual-planner-ui

## Directory Layout

```text
public/planner/
├── plants/
│   ├── tomato.svg
│   ├── lettuce.svg
│   └── ...
├── structures/
│   ├── greenhouse.svg
│   ├── raised_bed.svg
│   ├── terracotta_pot.svg
│   └── ...
├── categories/
│   ├── vegetable.svg      # fallbacks
│   ├── herb.svg
│   ├── fruit.svg
│   ├── tree.svg
│   └── flower.svg
├── templates/
│   ├── beginner-vegetable.webp
│   ├── small-orchard.webp
│   └── balcony-containers.webp
└── thumbnails/
    └── {gardenId}.webp      # user-generated, gitignored
```

## Asset Requirements

| Asset type | Format | Max size | Anchor point |
|------------|--------|----------|--------------|
| Plant illustration | SVG (preferred) or WebP | 64 KB | Bottom-center of footprint |
| Structure illustration | SVG | 128 KB | Top-left origin (matches area origin) |
| Category fallback | SVG | 32 KB | Bottom-center |
| Template preview | WebP | 200 KB | N/A (gallery only) |
| Plan thumbnail | WebP | 100 KB | N/A |

## Naming Conventions

- Plant specific: `plants/{canonical_slug}.svg` (slug from `canonical_plants.common_name`)
- Structure: `structures/{structure_type.slug}.svg`
- Category default: `categories/{illustration_category}.svg`

## Resolver Contract (`lib/planner/illustrations.ts`)

```typescript
resolvePlantIllustration(plantId: string, provenance: string): {
  url: string;           // always non-empty
  is_fallback: boolean;  // true when category default used
}

resolveStructureIllustration(slug: string): string

resolveCategoryDefault(category: string): string
```

**Guarantee**: `resolvePlantIllustration` NEVER returns null/empty (SC-004).

## Seeding

`scripts/seed-planner-assets.ts`:

1. Insert `illustration_category_defaults` for all categories
2. Map top-N canonical plants to `plant_illustrations` where asset file exists
3. Insert `structure_types` with paths for launch set (~30)
4. Insert 6 `plan_templates` with JSON snapshots

## Licensing

All artwork MUST be original or properly licensed for redistribution.
Document source in `public/planner/ATTRIBUTION.md` (planning artifact, not user-facing).

## CDN / Caching

Static files served by Next.js with `Cache-Control: public, max-age=31536000, immutable`
for hashed plant/structure assets; thumbnails uncached or short TTL.
