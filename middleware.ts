import { NextRequest, NextResponse } from "next/server";

const protectedPaths = [
  "/",
  "/holdings",
  "/watchlist",
  "/portfolio",
  "/ai-score",
  "/alerts",
  "/calendar",
  "/daily-report",
  "/backtest"
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }
  const protectedRoute = protectedPaths.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
  if (!protectedRoute) return NextResponse.next();
  if (request.cookies.get("stockradar_access_granted")?.value) return NextResponse.next();
  const settingsUrl = new URL("/settings", request.url);
  settingsUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(settingsUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
