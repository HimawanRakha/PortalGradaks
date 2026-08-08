import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic redirect only, based on cookie/session presence — the real
// authorization decision (role + scope) always happens server-side in
// lib/auth/dal.ts, never here. See Next.js auth guide's own recommendation
// against doing real authz in middleware/proxy.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  // Public NRP-only raport lookup for maba — no session involved, see
  // app/cek-raport/page.tsx. Must stay out of the isLoggedIn redirect below,
  // same as /login.
  const isPublicPage = isLoginPage || req.nextUrl.pathname.startsWith("/cek-raport");

  if (!isLoggedIn && !isPublicPage) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|loaderio-.*|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
