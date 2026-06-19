import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  GardenNotFoundError,
  PlacementValidationError,
  createDirectSeed,
} from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { createPlacementSchema } from "@/lib/garden/schemas";

interface RouteContext {
  params: Promise<{ gardenId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = createPlacementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const result = await createDirectSeed(gardenId, session.user.id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof GardenNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    if (error instanceof PlacementValidationError) {
      return NextResponse.json(
        { error: "validation_failed", violations: error.violations },
        { status: 422 },
      );
    }
    throw error;
  }
}
