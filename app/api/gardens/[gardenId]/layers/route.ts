import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { GardenNotFoundError, batchLayerUpdate } from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { layerPatchSchema } from "@/lib/garden/schemas";

interface RouteContext {
  params: Promise<{ gardenId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = layerPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await batchLayerUpdate(gardenId, session.user.id, parsed.data);
    return NextResponse.json(garden);
  } catch (error) {
    if (error instanceof GardenNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    throw error;
  }
}
