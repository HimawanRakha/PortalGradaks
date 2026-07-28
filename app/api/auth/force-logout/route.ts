import { NextRequest } from "next/server";
import { signOut } from "@/auth";

/**
 * Used by lib/auth/dal.ts's verifySession() when the JWT decodes fine but
 * the underlying User row is gone/deactivated (deleted account, reseed with
 * new ids, admin deactivation). A plain `redirect("/login")` from there
 * would loop forever: proxy.ts's isLoggedIn check only decodes the JWT (by
 * design — Next.js docs say proxy "should not be used as a full session
 * management... solution"), so it still sees a "logged in" user and bounces
 * `/login` straight back to `/`, which re-runs the same failing check.
 * A route handler CAN clear cookies (Server Components/verifySession
 * cannot), so signing out here — not just redirecting — breaks the loop:
 * the next hit to /login has no cookie left, so proxy.ts's check is false.
 */
export async function GET(request: NextRequest) {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  const redirectTo = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login";
  await signOut({ redirect: false });
  return Response.redirect(new URL(redirectTo, request.url));
}
