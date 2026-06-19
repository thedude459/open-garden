import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getPlantById } from "@/lib/catalog/query";
import { PlantDetailView } from "@/components/catalog/PlantDetail";
import { PinForOfflineToggle } from "@/components/catalog/PinForOfflineToggle";
import { db } from "@/lib/db/client";
import { userRecentlyViewed } from "@/lib/db/schema/user-data";

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!session?.user?.id) {
    notFound();
  }

  const { id } = await params;
  const plant = await getPlantById(id, session.user.id);
  if (!plant) {
    notFound();
  }

  await db
    .insert(userRecentlyViewed)
    .values({ userId: session.user.id, plantId: id })
    .onConflictDoUpdate({
      target: [userRecentlyViewed.userId, userRecentlyViewed.plantId],
      set: { viewedAt: new Date() },
    });

  return (
    <main className="stack">
      <PinForOfflineToggle plantId={id} />
      <PlantDetailView plant={plant} />
    </main>
  );
}
