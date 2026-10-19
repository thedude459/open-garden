import type { RainOutlook } from './ports';

export function parseRainSums(body: {
  daily?: { time?: string[]; rain_sum?: Array<number | null> };
}): Record<string, number> | null {
  const time = body.daily?.time;
  const sums = body.daily?.rain_sum;
  if (!time || !sums || time.length === 0 || time.length !== sums.length) return null;
  const daily: Record<string, number> = {};
  for (let i = 0; i < time.length; i++) {
    const day = time[i];
    const mm = sums[i];
    if (!day || mm == null || Number.isNaN(mm)) continue;
    daily[day] = mm;
  }
  return daily;
}

export class OpenMeteoRainOutlook implements RainOutlook {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async daily(
    latitude: number,
    longitude: number,
    _asOf: string,
  ): Promise<Record<string, number> | null> {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('daily', 'rain_sum');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '16');
    try {
      const response = await this.fetchFn(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return null;
      return parseRainSums((await response.json()) as { daily?: { time?: string[]; rain_sum?: Array<number | null> } });
    } catch {
      return null;
    }
  }
}
