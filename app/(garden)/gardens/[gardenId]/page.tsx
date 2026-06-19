import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getGardenDetail } from "@/lib/garden/service";
import { LayoutEditor } from "@/components/garden/LayoutEditor";

interface GardenDetailPageProps {
  params: Promise<{ gardenId: string }>;
}

export default async function GardenDetailPage({ params }: GardenDetailPageProps) {
  const session = await requireSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { gardenId } = await params;
  const garden = await getGardenDetail(gardenId, session.user.id);

  if (!garden) {
    notFound();
  }

  return (
    <div className="stack">
      <div className="row">
        <div className="stack">
          <h1>{garden.name}</h1>
          <p className="field-label">
            {garden.length} × {garden.width} {garden.unit}
            {garden.description ? ` · ${garden.description}` : ""}
          </p>
        </div>
        <Link className="btn secondary" href="/gardens">
          All gardens
        </Link>
      </div>
      <LayoutEditor initialGarden={garden} />
    </div>
  );
}
