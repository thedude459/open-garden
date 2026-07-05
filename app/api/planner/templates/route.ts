import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { listTemplates } from "@/lib/planner/templates";
import type { GardenZoneType } from "@/lib/garden/enums";
import { GARDEN_ZONE_TYPES } from "@/lib/garden/enums";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const zoneTypeParam = searchParams.get("zone_type");
  const zoneType =
    zoneTypeParam && GARDEN_ZONE_TYPES.includes(zoneTypeParam as GardenZoneType)
      ? (zoneTypeParam as GardenZoneType)
      : undefined;

  const templates = await listTemplates(zoneType);
  return NextResponse.json({ templates });
}
