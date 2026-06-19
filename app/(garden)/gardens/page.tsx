import Link from "next/link";
import { listGardens } from "@/lib/garden/service";
import { requireSession } from "@/lib/auth/session";
import { GardenList } from "@/components/garden/GardenList";
import { redirect } from "next/navigation";

export default async function GardensPage() {
  const session = await requireSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gardens = await listGardens(session.user.id);

  return (
    <div className="stack">
      <div className="row">
        <h1>Gardens</h1>
        <Link className="btn" href="/gardens/new">
          New garden
        </Link>
      </div>
      <GardenList gardens={gardens} />
    </div>
  );
}
