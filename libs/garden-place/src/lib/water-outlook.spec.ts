import { describe, expect, it } from 'vitest';
import { MAIN_STREET_PLACES, WASHINGTON_PLACE } from './fixtures';
import { shiftIsoDate } from './dates';
import {
  FixtureWaterOutlook,
  OpenMeteoWaterOutlook,
  parseDayWater,
  waterOutlookFor,
} from './water-outlook';

describe('water outlook', () => {
  it('reads each day’s evapotranspiration and rain, skipping gaps', () => {
    expect(
      parseDayWater({
        daily: {
          time: ['2026-06-01', '2026-06-02', '2026-06-03'],
          et0_fao_evapotranspiration: [4.2, null, 3],
          rain_sum: [0, 2, 6.5],
        },
      }),
    ).toEqual({
      '2026-06-01': { et0Mm: 4.2, rainMm: 0 },
      '2026-06-03': { et0Mm: 3, rainMm: 6.5 },
    });
    expect(parseDayWater({ daily: { time: [] } })).toBeNull();
    expect(
      parseDayWater({
        daily: { time: ['a', 'b'], et0_fao_evapotranspiration: [1], rain_sum: [1, 2] },
      }),
    ).toBeNull();
  });

  it('fixture: 4 mm a day and no rain, but 5 mm today at Washington', async () => {
    const fixture = new FixtureWaterOutlook();
    const asOf = '2026-06-30';
    const wet = await fixture.daily(WASHINGTON_PLACE.latitude, WASHINGTON_PLACE.longitude, asOf);
    expect(Object.keys(wet)).toHaveLength(37);
    expect(wet[asOf]).toEqual({ et0Mm: 4, rainMm: 5 });
    expect(wet[shiftIsoDate(asOf, -30)]).toEqual({ et0Mm: 4, rainMm: 0 });
    expect(wet[shiftIsoDate(asOf, 6)]).toEqual({ et0Mm: 4, rainMm: 0 });
    const dry = await fixture.daily(
      MAIN_STREET_PLACES[1]!.latitude,
      MAIN_STREET_PLACES[1]!.longitude,
      asOf,
    );
    expect(dry[asOf]).toEqual({ et0Mm: 4, rainMm: 0 });
  });

  it('uses Open-Meteo only when PLACE_PROVIDER is live', () => {
    expect(waterOutlookFor({ PLACE_PROVIDER: 'live' })).toBeInstanceOf(OpenMeteoWaterOutlook);
    expect(waterOutlookFor({})).toBeInstanceOf(FixtureWaterOutlook);
  });
});
