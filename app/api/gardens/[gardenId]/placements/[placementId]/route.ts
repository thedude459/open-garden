import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  GardenNotFoundError,
  PlacementNotFoundError,
  deletePlacement,
  updatePlacementPlantedOn,
} from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { deletePlacementSchema, updatePlacementSchema } from "@/lib/garden/schemas";

interface RouteContext {
  params: Promise<{ gardenId: string; placementId: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId, placementId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updatePlacementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await updatePlacementPlantedOn(
      gardenId,
      session.user.id,
      placementId,
      parsed.data,
    );
    return NextResponse.json(garden);
  } catch (error) {
    if (error instanceof GardenNotFoundError || error instanceof PlacementNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId, placementId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = deletePlacementSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await deletePlacement(
      gardenId,
      session.user.id,
      placementId,
      parsed.data.expected_version,
    );
    return NextResponse.json(garden);
  } catch (error) {
    if (error instanceof GardenNotFoundError || error instanceof PlacementNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    throw error;
  }
}
