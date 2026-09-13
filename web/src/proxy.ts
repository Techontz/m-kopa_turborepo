import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth check: pages other than the login screen require the session cookie.
 * Real authorization is enforced by the Laravel API on every request.
 */
export function proxy(request: NextRequest) {
  const hasToken = request.cookies.has("mf_token");
  const isLogin = request.nextUrl.pathname === "/login";

  if (!hasToken && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasToken && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|assets|favicon.ico).*)"],
};
