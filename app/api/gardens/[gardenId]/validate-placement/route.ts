import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { GardenNotFoundError, validatePlacementDryRun } from "@/lib/garden/service";
import { validatePlacementSchema } from "@/lib/garden/schemas";

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
  const parsed = validatePlacementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const result = await validatePlacementDryRun(gardenId, session.user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GardenNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
}
