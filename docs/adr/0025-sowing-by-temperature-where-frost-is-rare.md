# ADR 0025: Sowing windows by monthly temperature where frost is rare

## Status

Accepted

## Context

Sowing windows hang off a property's last and first frost. Where it rarely
or never frosts (the tropics, mild coasts) there are no frost dates, so the
calendar and Today showed no windows at all. The open-garden-data release
gives 38 of its 50 crops an air temperature range for growth
(`temperatureC`) and a soil temperature to sow (`minSoilTemperatureC`),
described as the fallback where there is no frost. It has nothing on wet and
dry seasons. The 12 crops without temperatures are perennials (trees, canes,
bushes, strawberry, asparagus, rhubarb, garlic, mint), planted rather than
sown in a yearly window.

## Decision

1. **Import the temperatures.** The importer reads `temperatureC.min`,
   `temperatureC.max`, and `minSoilTemperatureC` into the catalog
   (`plants.grow_min_c`, `grow_max_c`, `sow_soil_min_c`). The optimal
   temperature is not used yet.
2. **Monthly means per property.** The climate lookup that already
   downloads 30 years of daily minimums (ADR 0023) also asks for daily means
   and stores the mean of each calendar month on the property
   (`gardens.monthly_mean_c`, January first). A new address replaces them.
3. **Frost is rare** when the property has no frost dates and its coldest
   month averages 7 °C or more (`frostRare` in `libs/shared-types`). A
   property whose household cleared the frost dates in a place with cold
   winters does not qualify, so it is not given windows that ignore frost.
4. **Windows from temperature.** Where frost is rare, a crop can go in during
   a month whose mean is within its growth range and at least its soil
   minimum. The window is the longest unbroken run of such months, which may
   wrap the year end, from the 1st of its first month to the last day of its
   last. The crop's frost guidance still says how it is grown: a sowing
   window if it is sown in place, a transplant window if it is transplanted.
   Harvest follows from the start, as before. Indoor starts are not given.
5. **Frost dates win.** A property with both frost dates keeps frost-based
   windows. Property Settings, the Plan, and the calendar say when sowing
   follows the monthly temperatures instead.

## Consequences

+ Gardens in the tropics and on mild coasts get sowing windows for 38 crops.
- Windows are whole months; mean air temperature stands in for soil
  temperature.
- One window per crop: a cool crop with a spring and an autumn season in a
  hot place gets the longer one.
- Wet and dry seasons are ignored until the dataset has them; a window may
  fall in a dry season that needs irrigation.
- The 7 °C threshold is a rule of thumb; counting frost nights per year from
  the same daily data would be more exact.
