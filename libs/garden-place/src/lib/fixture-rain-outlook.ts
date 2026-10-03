import { isWashingtonPoint } from './fixtures';
import type { RainOutlook } from './ports';

export class FixtureRainOutlook implements RainOutlook {
  async daily(
    latitude: number,
    longitude: number,
    asOf: string,
  ): Promise<Record<string, number>> {
    const rainy = isWashingtonPoint(latitude, longitude);
    return {
      [shiftIsoDate(asOf, -1)]: 0,
      [asOf]: rainy ? 5 : 0,
      [shiftIsoDate(asOf, 1)]: 0,
    };
  }
}

export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}
