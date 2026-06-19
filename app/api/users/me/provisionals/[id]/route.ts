import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getProvisional } from "@/lib/catalog/provisionals";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const row = await getProvisional(session.user.id, id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ...row, provenance: "provisional" });
}
