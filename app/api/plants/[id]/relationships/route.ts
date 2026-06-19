import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getRelationships } from "@/lib/catalog/query";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const relationships = await getRelationships(id);
  return NextResponse.json(relationships);
}
