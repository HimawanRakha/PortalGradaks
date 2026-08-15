import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Optimistic redirect only, based on cookie/session presence — the real
// authorization decision (role + scope) always happens server-side in
// lib/auth/dal.ts, never here. See Next.js auth guide's own recommendation
// against doing real authz in middleware/proxy.
export default auth((req) => {
  const host = req.headers.get("host") || "";
  const pathname = req.nextUrl.pathname;

  // Rate limiting — proxy defaults to the Node.js runtime in this Next.js
  // version (not Edge), and Server Function calls route through here too
  // (they're POSTs to their originating page), so both the public NRP
  // lookup and the login form submission can be throttled from one place.
  // Thresholds are deliberately generous (shared campus IPs/NAT can put many
  // legitimate students behind one address) — this blunts scripted
  // scraping/brute-force, not normal concurrent use.
  if (pathname === "/cek-raport" && req.nextUrl.searchParams.has("nrp")) {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = checkRateLimit(`cek-raport:${ip}`, 40, 5 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Silakan coba lagi beberapa menit lagi." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }
  }

  if (pathname === "/login" && req.method === "POST") {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = checkRateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan masuk. Silakan coba lagi beberapa menit lagi." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }
  }

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

