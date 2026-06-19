import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  GardenNotFoundError,
  IndoorStartStateError,
  PlantingMethodError,
  createIndoorStart,
} from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { createIndoorStartSchema } from "@/lib/garden/schemas";

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
  const parsed = createIndoorStartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const result = await createIndoorStart(gardenId, session.user.id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof GardenNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    if (error instanceof PlantingMethodError || error instanceof IndoorStartStateError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
