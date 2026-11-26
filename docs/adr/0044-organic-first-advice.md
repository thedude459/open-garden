# ADR 0044: Advice is organic first

## Status

Accepted.

## Context

Open Garden gives a household advice: soil amendments from a soil test,
feeding and watering tasks, companion planting, and, from the dataset's
v0.3.2, pest and disease control. The maintainer asked that advice say what
the organic treatment is and prefer it by default.

The dataset's pests already follow integrated pest management (IPM): cultural,
physical, and biological controls first. Its products were one `chemical`
list, mixing what organic growing allows (Bt, spinosad, neem, insecticidal
soap, copper, sulfur) with what it does not (carbaryl, permethrin,
chlorothalonil, captan).

## Decision

- **Organic first, for all advice.** Where advice names a product or input,
  the app shows options allowed in organic growing by default. Conventional
  options are shown only when a household asks for them, never instead of an
  organic option that exists.
- **What counts as organic** is the country's organic rules for the region the
  guidance comes from. In the US that is the National Organic Program
  (7 CFR 205): biological and botanical substances (205.206(e)), natural
  substances 205.602 does not prohibit, and the synthetics 205.601 lists. The
  dataset decides this per region and records it, so the app does not.
- **Data:** a pest region's products are two groups, `organic` then
  `conventional` (open-garden-data v0.3.2). The app reads both and labels
  them.
- **What already fits:** soil advice names lime, sulfur, and compost, all
  allowed in organic growing. Feeding tasks name no product.
- **The label is the law** for both groups, and the app adds that a product
  should be labelled for organic use, since a formulation can add what the
  rules do not allow (pyrethrins with the synergist PBO are not organic).

## Consequences

- Pest advice (roadmap step 13) shows organic options by default; a
  household setting can show conventional ones too.
- New advice that names products (amendment rates from dataset v0.4,
  fertilizer suggestions) must give the organic option first, or say there is
  none.
- Some pests have no organic product in their guidance (squash vine borer in
  Minnesota): the app shows the non-chemical controls and says so, rather than
  falling back to a conventional product unasked.
