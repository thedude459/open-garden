import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  AreaGeometryError,
  GardenNotFoundError,
  InvalidRotationError,
  RotationNotAllowedError,
  StructureNotFoundError,
  deleteStructure,
  updateStructure,
} from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { deleteStructureSchema, updateStructureSchema } from "@/lib/garden/schemas";

interface RouteContext {
  params: Promise<{ gardenId: string; structureId: string }>;
}

function handleStructureMutationError(error: unknown) {
  if (error instanceof GardenNotFoundError || error instanceof StructureNotFoundError) {
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
  throw error;
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId, structureId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateStructureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await updateStructure(gardenId, session.user.id, structureId, parsed.data);
    return NextResponse.json(garden);
  } catch (error) {
    return handleStructureMutationError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId, structureId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = deleteStructureSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await deleteStructure(
      gardenId,
      session.user.id,
      structureId,
      parsed.data.expected_version,
    );
    return NextResponse.json(garden);
  } catch (error) {
    return handleStructureMutationError(error);
  }
}
