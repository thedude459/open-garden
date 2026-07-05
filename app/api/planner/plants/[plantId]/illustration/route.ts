import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { resolvePlantIllustration } from "@/lib/planner/illustrations";

interface RouteContext {
  params: Promise<{ plantId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plantId } = await context.params;
  const illustration = await resolvePlantIllustration(plantId, "authoritative");
  return NextResponse.json({
    url: illustration.url,
    is_fallback: illustration.is_fallback,
  });
}
