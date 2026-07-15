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
  "/backtest",
  "/settings"
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/login" || pathname.startsWith("/auth")) {
    return NextResponse.next();
  }
  const protectedRoute = protectedPaths.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
  if (!protectedRoute) return NextResponse.next();
  if (request.cookies.get("stockradar_access_token")?.value) return NextResponse.next();
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
