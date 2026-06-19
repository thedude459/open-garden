import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { searchPlants } from "@/lib/catalog/search";
import type { PlantCategory } from "@/lib/catalog/enums";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") as PlantCategory | null;
  const sun = searchParams.get("sun") as "full" | "partial" | "shade" | null;
  const spacingMin = searchParams.get("spacing_min");
  const climateFilter = searchParams.get("climate_filter") === "true";

  try {
    const result = await searchPlants({
      userId: session.user.id,
      q,
      category: category ?? undefined,
      sun: sun ?? undefined,
      spacingMin: spacingMin ? Number(spacingMin) : undefined,
      climateFilter,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "NO_LOCATION") {
      return NextResponse.json(
        { error: "Location required for climate filter" },
        { status: 422 },
      );
    }
    throw error;
  }
}
