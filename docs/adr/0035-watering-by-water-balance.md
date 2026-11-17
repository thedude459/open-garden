# ADR 0035: Watering by water balance

## Status

Accepted.

## Context

Watering reminders came every N days, from the dataset's water class (low,
moderate, high), with a rain note when the due day was wet (ADR 0008). A
tomato in July and one just planted out in May got the same interval, and a
week of rain did not move the next watering. Phase 4 item 4 asks for watering
by what the plant actually uses.

Dataset v0.2.1 carries FAO-56 crop coefficients (Kc for the initial, mid, and
end of season) and the days in each growth stage for 39 of its 58 crops, and
the app has imported them since migration 0012. Open-Meteo, already used for
the rain outlook, also publishes daily reference evapotranspiration (ET₀,
FAO-56 Penman-Monteith).

## Decision

1. **One weather request per property.** `WaterOutlook` in `garden-place`
   returns each day's ET₀ and rain from 30 days before today to 6 days after
   (`et0_fao_evapotranspiration,rain_sum`), kept for an hour, so the reminders
   page, Today, and the daily send share it. It replaces the rain-only outlook,
   whose rain now comes from the same answer. `FixtureWaterOutlook` gives 4 mm
   of ET₀ a day and no rain, except 5 mm today at the Washington test address
   (the rain the old fixture gave).
2. **The balance, in `care-reminders` (pure):**
   - **Crop coefficient** by days since planting, FAO-56 Eq. 66: `initial`,
     rising in a line to `mid` across development, `mid`, then falling to
     `end`. A crop without stage lengths, and a perennial or tree, stands at
     `mid`.
   - **Daily balance**, FAO-56 Eq. 85 simplified: from the last watering (the
     soil full), each day the crop uses ET₀ × Kc × the bed's factor; rain
     counts when it is at least a fifth of the day's ET₀ (FAO-56: lighter rain
     evaporates first); the deficit never goes below zero, since more drains
     away.
   - **Due** on the first day the deficit reaches 25 mm, looking to the end of
     the forecast: readily available water (RAW = p × TAW) for vegetables in a
     garden loam, about 140 mm per metre of soil, roots 0.3–0.5 m deep, and
     p ≈ 0.4. Not due within the forecast means no watering reminder.
   - **The bed's factor:** sun (full 1, part 0.8, shade 0.6) times mulch
     (none 1, organic 0.9, plastic 0.85).
3. **Which plantings.** A planting in a bed, not harvested, whose crop has
   coefficients, waters by the balance; its reminder has no fixed interval and
   carries the deficit (`deficitMm`). Everything else (trays, waiting
   transplants, crops without coefficients, a property without a location, or
   weather that cannot be read) keeps the fixed interval as before.
4. **The last watering** is the day a water reminder was completed or
   dismissed (the event's recorded day), so watering late does not count the
   overdue days twice. Dismissing means "not needed" and starts the count
   again too.
5. **Shown** on the reminders page as "Soil about 1.0 in short of water" in
   the member's units. Rain on the due day still marks it not needed.

## Consequences

- Watering follows the weather and the plant's stage: less early in the
  season, more at full cover, and a rainy week moves it back.
- Simplifications, each marked `ponytail` in code: one threshold for every
  crop and soil (per-crop root depth and the bed's soil texture are the
  upgrade); fixed sun and mulch factors instead of FAO-56's dual coefficients;
  no dormant season for perennials.
- A planting watered more than 30 days ago counts from the first day the
  weather covers, so its first reminder can come a little late.
- The temperature outlook for frost and heat alerts (ADR 0032) still makes its
  own request; folding it into the same one is under Ideas.
- Moisture sensor readings (Phase 4 item 6) would replace the estimate when
  they arrive.
