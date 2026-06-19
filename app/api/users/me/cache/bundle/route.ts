import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { buildCacheBundle } from "@/lib/offline/cache-manifest";

export async function GET() {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await buildCacheBundle(session.user.id);
  return NextResponse.json(bundle);
}
