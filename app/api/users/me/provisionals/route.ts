import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createProvisional, listProvisionals } from "@/lib/catalog/provisionals";
import type { PlantCategory } from "@/lib/catalog/enums";

export async function GET() {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await listProvisionals(session.user.id);
  return NextResponse.json({ provisionals: rows });
}

const createSchema = z.object({
  common_name: z.string().min(1),
  plant_category: z.string(),
  spacing_cm: z.object({ row: z.number().optional(), plant: z.number().optional() }),
  days_to_maturity: z.number().int().positive(),
  optional_fields: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  }

  const row = await createProvisional(session.user.id, {
    ...parsed.data,
    plant_category: parsed.data.plant_category as PlantCategory,
  });

  return NextResponse.json(
    { ...row, provenance: "provisional" },
    { status: 201 },
  );
}
