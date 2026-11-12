import type { PlaceCandidateDto } from '@open-garden/shared-types';
import type { ClimateFacts, ClimateLookup, MonthDay } from './ports';

/**
 * The frost-free season runs from last frost to first frost. In the north it
 * sits inside one calendar year (last frost earlier); south of the equator it
 * wraps the year end (last frost in spring, later in the calendar year than
 * first frost in autumn). A place with no latitude follows the north.
 */
export function frostInOrder(last: MonthDay, first: MonthDay, latitude?: number | null): boolean {
  const lastKey = last.month * 100 + last.day;
  const firstKey = first.month * 100 + first.day;
  return latitude != null && latitude < 0 ? firstKey < lastKey : lastKey < firstKey;
}

/** Keep both frost dates when they are valid and in order for the hemisphere; otherwise neither. */
export function keepFrostPair(
  last: MonthDay | null,
  first: MonthDay | null,
  latitude?: number | null,
): { last: MonthDay | null; first: MonthDay | null } {
  if (!last || !first) return { last: null, first: null };
  if (!validDay(last) || !validDay(first)) return { last: null, first: null };
  if (!frostInOrder(last, first, latitude)) return { last: null, first: null };
  return { last, first };
}

function validDay(value: MonthDay): boolean {
  return value.month >= 1 && value.month <= 12 && value.day >= 1 && value.day <= 31;
}

export class FixtureClimateLookup implements ClimateLookup {
  async lookup(place: PlaceCandidateDto): Promise<ClimateFacts> {
    if (place.countryCode === 'US' && place.postalCode === '20500') {
      return {
        hardinessZone: 8,
        lastFrost: { month: 4, day: 15 },
        firstFrost: { month: 10, day: 20 },
        monthlyMeanC: [2, 4, 9, 14, 20, 25, 27, 26, 22, 15, 10, 4],
        frostRisk: {
          lateLastFrost: { month: 5, day: 2 },
          earlyFirstFrost: { month: 10, day: 5 },
        },
      };
    }
    if (place.placeId === 'fixture-honolulu') {
      return {
        hardinessZone: 12,
        lastFrost: null,
        firstFrost: null,
        monthlyMeanC: [23, 23, 23, 24, 25, 26, 27, 27, 27, 26, 25, 24],
      };
    }
    return NO_CLIMATE;
  }
}

const NO_CLIMATE: ClimateFacts = {
  hardinessZone: null,
  lastFrost: null,
  firstFrost: null,
  monthlyMeanC: null,
};

const DAY_MS = 86_400_000;
const MIN_DAYS_PER_YEAR = 300;

/** Day of year in a fixed non-leap year (0–364); 29 February counts as the 28th. */
function dayOfYear(month: number, day: number): number {
  const d = month === 2 && day === 29 ? 28 : day;
  return Math.round((Date.UTC(2023, month - 1, d) - Date.UTC(2023, 0, 1)) / DAY_MS);
}

function monthDayOf(doy: number): MonthDay {
  const date = new Date(Date.UTC(2023, 0, 1) + doy * DAY_MS);
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

/** Nearest-rank percentile (0–1) of `values`. */
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;
}

/** USDA hardiness zone from a mean annual extreme minimum: 10 °F bands from -60 °F. */
export function zoneFromMinimum(celsius: number): number {
  const fahrenheit = (celsius * 9) / 5 + 32;
  return Math.min(13, Math.max(1, Math.floor((fahrenheit + 60) / 10) + 1));
}

/**
 * Zone and median frost dates from daily minimum temperatures (°C), one per
 * day, `time` as YYYY-MM-DD. A frost is a minimum at or below 0 °C. Each
 * growing year runs from midwinter to midwinter (1 January in the north, 1
 * July in the south): last frost is the latest frost before midsummer, first
 * frost the earliest after it. A year without one counts as frost-free on that
 * side, so a mostly frost-free place gets no dates. Years with gaps are skipped.
 */
export function climateFromDailyMinimums(
  time: readonly string[],
  minimums: readonly (number | null)[],
  latitude: number,
  means: readonly (number | null)[] = [],
): ClimateFacts {
  const monthlyMeanC = monthlyMeans(time, means);
  const seasonStart = latitude < 0 ? dayOfYear(7, 1) : 0;
  const coldest = new Map<number, number>();
  const counts = new Map<number, number>();
  const seasons = new Map<number, { last: number; first: number; days: number }>();
  for (let i = 0; i < time.length; i++) {
    const t = minimums[i];
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(time[i] ?? '');
    if (t == null || !Number.isFinite(t) || !match) continue;
    const year = Number(match[1]);
    const doy = dayOfYear(Number(match[2]), Number(match[3]));
    coldest.set(year, Math.min(coldest.get(year) ?? Infinity, t));
    counts.set(year, (counts.get(year) ?? 0) + 1);
    const seasonYear = doy < seasonStart ? year - 1 : year;
    const offset = (doy - seasonStart + 365) % 365;
    const season = seasons.get(seasonYear) ?? { last: -1, first: 365, days: 0 };
    season.days += 1;
    if (t <= 0) {
      if (offset < 182) season.last = Math.max(season.last, offset);
      else season.first = Math.min(season.first, offset);
    }
    seasons.set(seasonYear, season);
  }

  const minimaOfFullYears = [...coldest]
    .filter(([year]) => (counts.get(year) ?? 0) >= MIN_DAYS_PER_YEAR)
    .map(([, t]) => t);
  const hardinessZone = minimaOfFullYears.length
    ? zoneFromMinimum(minimaOfFullYears.reduce((a, b) => a + b, 0) / minimaOfFullYears.length)
    : null;

  const full = [...seasons.values()].filter((s) => s.days >= MIN_DAYS_PER_YEAR);
  if (full.length === 0) return { hardinessZone, lastFrost: null, firstFrost: null, monthlyMeanC };
  const last = median(full.map((s) => s.last));
  const first = median(full.map((s) => s.first));
  const date = (offset: number) => monthDayOf((offset + seasonStart) % 365);
  const lastFrost = last < 0 ? null : date(last);
  const firstFrost = first > 364 ? null : date(first);
  // A frost-free side counts as frost-free, so with both medians set these
  // stay inside the season: the late last frost is at or after the median.
  const frostRisk =
    lastFrost && firstFrost
      ? {
          lateLastFrost: date(
            percentile(
              full.map((s) => s.last),
              0.9,
            ),
          ),
          earlyFirstFrost: date(
            percentile(
              full.map((s) => s.first),
              0.1,
            ),
          ),
        }
      : null;
  return { hardinessZone, lastFrost, firstFrost, monthlyMeanC, frostRisk };
}

/** Mean of the daily means in each calendar month, to a tenth; null unless every month has a year's worth. */
function monthlyMeans(time: readonly string[], means: readonly (number | null)[]): number[] | null {
  const sums = new Array<number>(12).fill(0);
  const counts = new Array<number>(12).fill(0);
  for (let i = 0; i < time.length; i++) {
    const t = means[i];
    const month = Number(time[i]?.slice(5, 7));
    if (t == null || !Number.isFinite(t) || !(month >= 1 && month <= 12)) continue;
    sums[month - 1]! += t;
    counts[month - 1]! += 1;
  }
  if (counts.some((n) => n < 28)) return null;
  return sums.map((sum, m) => Math.round((sum / counts[m]!) * 10) / 10);
}

/**
 * Zone and frost dates anywhere, from 30 years of Open-Meteo's historical
 * daily minimums (ERA5 reanalysis, about 10 km cells; no key).
 * ponytail: a valley or frost pocket colder than its cell gets dates that are
 * too mild; the household can correct them on the property. Each lookup
 * downloads about 11 000 values; cache by rounded coordinates if lookups
 * become frequent.
 */
export class LiveClimateLookup implements ClimateLookup {
  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async lookup(place: PlaceCandidateDto): Promise<ClimateFacts> {
    const lastYear = this.now().getUTCFullYear() - 1;
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', String(place.latitude));
    url.searchParams.set('longitude', String(place.longitude));
    url.searchParams.set('start_date', `${lastYear - 29}-01-01`);
    url.searchParams.set('end_date', `${lastYear}-12-31`);
    url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_mean');
    url.searchParams.set('timezone', 'auto');
    const none = NO_CLIMATE;
    try {
      const response = await this.fetchFn(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return none;
      const body = (await response.json()) as {
        daily?: {
          time?: string[];
          temperature_2m_min?: Array<number | null>;
          temperature_2m_mean?: Array<number | null>;
        };
      };
      const time = body.daily?.time;
      const minimums = body.daily?.temperature_2m_min;
      if (!time || !minimums || time.length !== minimums.length) return none;
      const facts = climateFromDailyMinimums(
        time,
        minimums,
        place.latitude,
        body.daily?.temperature_2m_mean ?? [],
      );
      const pair = keepFrostPair(facts.lastFrost, facts.firstFrost, place.latitude);
      return {
        ...facts,
        lastFrost: pair.last,
        firstFrost: pair.first,
        frostRisk: pair.last ? facts.frostRisk : null,
      };
    } catch {
      return none;
    }
  }
}
