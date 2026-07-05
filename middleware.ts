import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isLoggedIn = !!token;
  const { pathname } = req.nextUrl;

  const isCatalogPage = pathname.startsWith("/plants");
  const isGardenPage = pathname.startsWith("/gardens");
  const isPlantsApi =
    pathname.startsWith("/api/plants") || pathname.startsWith("/api/users/me");
  const isGardensApi = pathname.startsWith("/api/gardens");
  const isPlannerApi = pathname.startsWith("/api/planner");

  if ((isCatalogPage || isGardenPage || isPlantsApi || isGardensApi || isPlannerApi) && !isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/plants/:path*",
    "/gardens/:path*",
    "/api/plants/:path*",
    "/api/users/me/:path*",
    "/api/gardens/:path*",
    "/api/planner/:path*",
  ],
};
