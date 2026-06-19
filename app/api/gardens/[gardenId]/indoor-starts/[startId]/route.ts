import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  GardenNotFoundError,
  IndoorStartNotFoundError,
  IndoorStartStateError,
  cancelIndoorStart,
  reassignIndoorStart,
} from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { deleteIndoorStartSchema, updateIndoorStartSchema } from "@/lib/garden/schemas";

interface RouteContext {
  params: Promise<{ gardenId: string; startId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId, startId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateIndoorStartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await reassignIndoorStart(gardenId, session.user.id, startId, parsed.data);
    return NextResponse.json(garden);
  } catch (error) {
    if (error instanceof GardenNotFoundError || error instanceof IndoorStartNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    if (error instanceof IndoorStartStateError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId, startId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = deleteIndoorStartSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const garden = await cancelIndoorStart(
      gardenId,
      session.user.id,
      startId,
      parsed.data.expected_version,
    );
    return NextResponse.json(garden);
  } catch (error) {
    if (error instanceof GardenNotFoundError || error instanceof IndoorStartNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    if (error instanceof IndoorStartStateError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
