import { db } from "@/lib/db/client";
import { userLocations } from "@/lib/db/schema/user-data";
import { eq } from "drizzle-orm";

export interface ResolvedLocation {
  cityOrPostal: string;
  usdaZone: number | null;
  lastFrostDate: string | null;
  firstFrostDate: string | null;
  latitude: string | null;
  longitude: string | null;
}

const POSTAL_ZONE_MAP: Record<string, { zone: number; lastFrost: string; firstFrost: string }> = {
  "97201": { zone: 8, lastFrost: "2026-04-15", firstFrost: "2026-11-01" },
  "10001": { zone: 7, lastFrost: "2026-04-20", firstFrost: "2026-11-05" },
  "90210": { zone: 10, lastFrost: "2026-02-01", firstFrost: "2026-12-15" },
};

export function resolveLocation(cityOrPostal: string): ResolvedLocation {
  const key = cityOrPostal.trim();
  const mapped = POSTAL_ZONE_MAP[key] ?? {
    zone: 6,
    lastFrost: "2026-05-01",
    firstFrost: "2026-10-15",
  };

  return {
    cityOrPostal: key,
    usdaZone: mapped.zone,
    lastFrostDate: mapped.lastFrost,
    firstFrostDate: mapped.firstFrost,
    latitude: null,
    longitude: null,
  };
}

export async function getUserLocation(userId: string) {
  const [row] = await db
    .select()
    .from(userLocations)
    .where(eq(userLocations.userId, userId))
    .limit(1);

  if (!row) return null;

  return {
    city_or_postal: row.cityOrPostal,
    usda_zone: row.usdaZone,
    last_frost_date: row.lastFrostDate,
    first_frost_date: row.firstFrostDate,
  };
}

export async function saveUserLocation(userId: string, cityOrPostal: string) {
  const resolved = resolveLocation(cityOrPostal);

  const [row] = await db
    .insert(userLocations)
    .values({
      userId,
      cityOrPostal: resolved.cityOrPostal,
      usdaZone: resolved.usdaZone,
      lastFrostDate: resolved.lastFrostDate,
      firstFrostDate: resolved.firstFrostDate,
    })
    .onConflictDoUpdate({
      target: userLocations.userId,
      set: {
        cityOrPostal: resolved.cityOrPostal,
        usdaZone: resolved.usdaZone,
        lastFrostDate: resolved.lastFrostDate,
        firstFrostDate: resolved.firstFrostDate,
        updatedAt: new Date(),
      },
    })
    .returning();

  return {
    city_or_postal: row.cityOrPostal,
    usda_zone: row.usdaZone,
    last_frost_date: row.lastFrostDate,
    first_frost_date: row.firstFrostDate,
  };
}
