# ADR 0027: 1-in-10 frost dates beside the median

## Status

Accepted

## Context

A property's frost dates are medians from 30 years of daily minimums (ADR
0023): in half of years the last spring frost comes later. Gardeners
planting tender crops, or protecting fruit blossom, want a safer date. The
same yearly frost dates give one without new data.

## Decision

1. **Two more dates from the same data.** From each year's last spring and
   first autumn frost, the climate lookup takes the 90th percentile of the
   last frosts and the 10th of the first frosts (nearest rank): frost comes
   after the first date in 1 spring in 10, and before the second in 1 autumn
   in 10. They exist only when both median dates do, and follow the
   property's hemisphere like the medians.
2. **Stored beside the medians, from the climate only.** Four columns on
   `gardens`, replaced when the address changes. They are not editable: a
   household changing its median dates by hand does not change what the
   weather record says.
3. **Shown, not used.** Property Settings show the two dates in the reader's
   date format. Sowing windows still hang off the medians; a member who
   wants the safer dates sets them as the frost dates.

## Consequences

+ Households see how much later a frost can come without new data or calls.
- Thirty years gives three years past the 1-in-10 line, so the dates move
  by a few days as the record moves forward a year.
- Windows do not offer a "cautious" mode; that waits for someone to ask.
