import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  GardenNotFoundError,
  saveGardenThumbnail,
} from "@/lib/garden/service";
import { ConflictError } from "@/lib/garden/version";
import { thumbnailPostSchema } from "@/lib/garden/schemas";

interface RouteContext {
  params: Promise<{ gardenId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gardenId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = thumbnailPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }

  const match = parsed.data.image_data.match(/^data:image\/webp;base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid image_data format" }, { status: 422 });
  }

  try {
    const thumbnailDir = path.join(process.cwd(), "public/planner/thumbnails");
    await mkdir(thumbnailDir, { recursive: true });
    const filename = `${gardenId}.webp`;
    await writeFile(path.join(thumbnailDir, filename), Buffer.from(match[1], "base64"));

    const result = await saveGardenThumbnail(
      gardenId,
      session.user.id,
      parsed.data.expected_version,
      `planner/thumbnails/${filename}`,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GardenNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "conflict", current: error.current }, { status: 409 });
    }
    throw error;
  }
}
