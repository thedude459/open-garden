import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getPlantById } from "@/lib/catalog/query";
import { db } from "@/lib/db/client";
import { userRecentlyViewed } from "@/lib/db/schema/user-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const plant = await getPlantById(id, session.user.id);

  if (!plant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .insert(userRecentlyViewed)
    .values({ userId: session.user.id, plantId: id })
    .onConflictDoUpdate({
      target: [userRecentlyViewed.userId, userRecentlyViewed.plantId],
      set: { viewedAt: new Date() },
    });

  return NextResponse.json(plant);
}
