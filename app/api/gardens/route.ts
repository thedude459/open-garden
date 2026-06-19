import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createGarden, listGardens } from "@/lib/garden/service";
import { createGardenSchema } from "@/lib/garden/schemas";

export async function GET() {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gardens = await listGardens(session.user.id);
  return NextResponse.json({ gardens });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createGardenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  const garden = await createGarden(session.user.id, parsed.data);
  return NextResponse.json(garden, { status: 201 });
}
