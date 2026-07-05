import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  AreaGeometryError,
  GardenNotFoundError,
  InvalidRotationError,
  RotationNotAllowedError,
  StructureTypeNotFoundError,
  StructureZoneError,
  createStructure,
} from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { createStructureSchema } from "@/lib/garden/schemas";

interface RouteContext {
  params: Promise<{ gardenId: string }>;
}

function handleStructureMutationError(error: unknown) {
  if (error instanceof GardenNotFoundError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
  }
  if (error instanceof StructureTypeNotFoundError) {
    return NextResponse.json({ error: "structure_type_not_found" }, { status: 404 });
  }
  if (error instanceof StructureZoneError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
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

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = createStructureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await createStructure(gardenId, session.user.id, parsed.data);
    return NextResponse.json(garden, { status: 201 });
  } catch (error) {
    return handleStructureMutationError(error);
  }
}
