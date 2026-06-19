import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  AreaGeometryError,
  AreaNotFoundError,
  GardenNotFoundError,
  InvalidRotationError,
  LayoutShrinkError,
  RotationNotAllowedError,
  deleteArea,
  updateArea,
} from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { deleteAreaSchema, updateAreaSchema } from "@/lib/garden/schemas";

interface RouteContext {
  params: Promise<{ gardenId: string; areaId: string }>;
}

function handleGardenMutationError(error: unknown) {
  if (error instanceof GardenNotFoundError || error instanceof AreaNotFoundError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
  }
  if (error instanceof AreaGeometryError) {
    return NextResponse.json(
      { error: "validation_failed", violations: error.violations },
      { status: 422 },
    );
  }
  if (error instanceof RotationNotAllowedError || error instanceof InvalidRotationError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  if (error instanceof LayoutShrinkError) {
    return NextResponse.json(
      {
        error: "placement_eviction_required",
        affected_placement_ids: error.affectedPlacementIds,
      },
      { status: 422 },
    );
  }
  throw error;
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId, areaId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateAreaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await updateArea(gardenId, session.user.id, areaId, parsed.data);
    return NextResponse.json(garden);
  } catch (error) {
    return handleGardenMutationError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId, areaId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = deleteAreaSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await deleteArea(gardenId, session.user.id, areaId, parsed.data.expected_version);
    return NextResponse.json(garden);
  } catch (error) {
    return handleGardenMutationError(error);
  }
}
