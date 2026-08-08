import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic redirect only, based on cookie/session presence — the real
// authorization decision (role + scope) always happens server-side in
// lib/auth/dal.ts, never here. See Next.js auth guide's own recommendation
// against doing real authz in middleware/proxy.
export default auth((req) => {
  const host = req.headers.get("host") || "";
  const pathname = req.nextUrl.pathname;

  // 1. Maba domain / subdomain handling (e.g. contains 'raport', 'maba', or 'cek-raport')
  if (host.includes("raport") || host.includes("maba") || host.includes("cek-raport")) {
    // Rewrite root "/" directly to "/cek-raport" so maba lands straight on the lookup form
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/cek-raport", req.nextUrl));
    }

    // Lock out access to dashboard/login/admin routes on the maba domain
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/mentor") ||
      pathname.startsWith("/kepala-region") ||
      pathname.startsWith("/event")
    ) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }

    return NextResponse.next();
  }

  // 2. Main portal routing (Mentor/Admin/PSDM)
  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === "/login";
  const isPublicPage = isLoginPage || pathname.startsWith("/cek-raport");

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

