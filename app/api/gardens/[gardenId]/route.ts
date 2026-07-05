import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  AreaGeometryError,
  GardenNotFoundError,
  LayoutShrinkError,
  ZoneChangeConflictError,
  deleteGarden,
  getGardenDetail,
  updateGarden,
} from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { deleteGardenSchema, updateGardenSchema } from "@/lib/garden/schemas";

interface RouteContext {
  params: Promise<{ gardenId: string }>;
}

function handleGardenMutationError(error: unknown) {
  if (error instanceof GardenNotFoundError) {
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
  if (error instanceof LayoutShrinkError) {
    return NextResponse.json(
      {
        error: "placement_eviction_required",
        affected_placement_ids: error.affectedPlacementIds,
      },
      { status: 422 },
    );
  }
  if (error instanceof ZoneChangeConflictError) {
    return NextResponse.json(
      {
        error: "zone_change_conflicts",
        conflicts: error.conflicts,
      },
      { status: 422 },
    );
  }
  throw error;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId } = await context.params;
  const garden = await getGardenDetail(gardenId, session.user.id);

  if (!garden) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(garden);
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateGardenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await updateGarden(gardenId, session.user.id, parsed.data);
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

  const { gardenId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = deleteGardenSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    await deleteGarden(gardenId, session.user.id, parsed.data.expected_version);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleGardenMutationError(error);
  }
}
