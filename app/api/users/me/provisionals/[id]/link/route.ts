import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { linkProvisionalToCanonical } from "@/lib/catalog/merge-provisional";

const linkSchema = z.object({
  canonical_plant_id: z.string().uuid(),
  confirm: z.literal(true),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  }

  const { id } = await context.params;

  try {
    const merged = await linkProvisionalToCanonical(
      session.user.id,
      id,
      parsed.data.canonical_plant_id,
    );
    return NextResponse.json(merged);
  } catch (error) {
    if (error instanceof Error && error.message === "NO_LINK_OFFER") {
      return NextResponse.json({ error: "No pending link offer" }, { status: 409 });
    }
    throw error;
  }
}
