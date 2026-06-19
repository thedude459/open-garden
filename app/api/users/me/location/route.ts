import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getUserLocation, saveUserLocation } from "@/lib/catalog/geocode";

export async function GET() {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const location = await getUserLocation(session.user.id);
  if (!location) {
    return NextResponse.json({ error: "No location saved" }, { status: 404 });
  }

  return NextResponse.json(location);
}

const locationSchema = z.object({
  city_or_postal: z.string().min(3),
});

export async function PUT(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  }

  const location = await saveUserLocation(session.user.id, parsed.data.city_or_postal);
  return NextResponse.json(location);
}
