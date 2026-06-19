import { NextResponse } from "next/server";
import { runPlantSync } from "@/lib/ingestion/sync-job";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runPlantSync();
  return NextResponse.json({ ok: true, result });
}
