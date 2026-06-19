import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userGardenPlantRefs } from "@/lib/db/schema/user-data";
import { and, eq } from "drizzle-orm";

const pinSchema = z.object({
  plant_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  }

  const [row] = await db
    .insert(userGardenPlantRefs)
    .values({ userId: session.user.id, plantId: parsed.data.plant_id })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json({ pinned: row ?? { plant_id: parsed.data.plant_id } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const plantId = searchParams.get("plant_id");
  if (!plantId) {
    return NextResponse.json({ error: "plant_id required" }, { status: 422 });
  }

  await db
    .delete(userGardenPlantRefs)
    .where(
      and(
        eq(userGardenPlantRefs.userId, session.user.id),
        eq(userGardenPlantRefs.plantId, plantId),
      ),
    );

  return NextResponse.json({ ok: true });
}
