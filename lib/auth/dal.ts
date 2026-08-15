import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";

export type SessionUser = {
  id: string;
  nrp: string | null;
  name?: string | null;
  role: Role;
  regionId: string | null;
  unitId: string | null;
};

export class ForbiddenError extends Error {
  constructor(message = "Anda tidak memiliki akses untuk tindakan ini.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Single source of truth for "is there a logged-in user." Cached per
 * request so calling it from many places (layout, page, actions) costs
 * one session lookup. Redirects to /login if there is no session — every
 * Server Action / page / route handler in (dashboard) should call this
 * (or a helper built on it) before touching data, never rely on
 * proxy.ts's optimistic redirect alone.
 *
 * Also re-validates against the DB on every call (deduped per-request by
 * `cache()`, so still one extra query, not one per component). The JWT
 * caches role/regionId/unitId from sign-in time and next-auth never
 * refreshes them on its own — so a deleted/deactivated account, or an
 * admin reassigning someone's role/region/unit, would otherwise stay stale
 * in the browser's cookie until it happened to expire. This is deliberately
 * NOT done in proxy.ts: Next.js 16 documents proxy as "not intended for
 * slow data fetching" and this project's own proxy.ts comment already
 * calls its check "optimistic only" — this function is the real check.
 *
 * On failure this redirects to /api/auth/force-logout, NOT plain /login —
 * a bare `redirect("/login")` here loops forever: proxy.ts's isLoggedIn
 * check only decodes the JWT (same "stay fast" reasoning as above) and
 * would keep seeing a "logged in" user, bouncing /login straight back to
 * `/`, which re-runs this same failing check. Only a route handler can
 * actually clear the cookie (Server Components can't), which is what
 * breaks the loop.
 */
export const verifySession = cache(async (): Promise<{ user: SessionUser }> => {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nrp: true, name: true, role: true, regionId: true, unitId: true, active: true, lastActiveAt: true },
  });
  if (!dbUser || !dbUser.active) {
    redirect("/api/auth/force-logout");
  }

  // Update lastActiveAt throttled (max once every 2 minutes)
  const now = new Date();
  if (!dbUser.lastActiveAt || now.getTime() - dbUser.lastActiveAt.getTime() > 2 * 60 * 1000) {
    prisma.user
      .update({
        where: { id: session.user.id },
        data: { lastActiveAt: now },
      })
      .catch(() => {});
  }

  return {
    user: {
      id: session.user.id,
      nrp: dbUser.nrp,
      name: dbUser.name,
      role: dbUser.role,
      regionId: dbUser.regionId,
      unitId: dbUser.unitId,
    },
  };
});

export async function getCurrentUser(): Promise<SessionUser> {
  const { user } = await verifySession();
  return user;
}

export async function assertRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) {
    throw new ForbiddenError();
  }
  return user;
}

export const assertCanManageMasterData = () => assertRole(Role.ADMIN);
export const assertCanImport = () => assertRole(Role.ADMIN);
export const assertCanFinalize = () => assertRole(Role.ADMIN);
/** Terkompak (per region) + Winner Throne Battle (per unit) entry for the Inclenation event scoreboard. */
export const assertCanScoreInclenationEvent = () => assertRole(Role.ADMIN, Role.EVENT);

/**
 * Mentor scope = own unit only; Kepala Region scope = own region's units;
 * Admin = global. Centralized here so no page/action re-derives scope
 * logic independently.
 */
export async function assertCanViewUnit(unitId: string, user?: SessionUser): Promise<void> {
  const currentUser = user ?? (await getCurrentUser());
  if (currentUser.role === Role.ADMIN || currentUser.role === Role.EVENT) return;

  if (currentUser.role === Role.KEPALA_REGION) {
    if (!currentUser.regionId) throw new ForbiddenError();
    const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { regionId: true } });
    if (unit?.regionId === currentUser.regionId) return;
    throw new ForbiddenError();
  }

  if (currentUser.role === Role.MENTOR || currentUser.role === Role.DAMEN) {
    if (currentUser.unitId === unitId) return;
    throw new ForbiddenError();
  }

  throw new ForbiddenError();
}

export async function assertCanViewStudent(studentId: string, user?: SessionUser): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { unitId: true },
  });
  // A stale/deleted studentId (e.g. a bookmarked URL from before a reseed)
  // is a missing-page case, not a permission error — 404, don't crash.
  if (!student) notFound();
  await assertCanViewUnit(student.unitId, user);
}

export async function assertCanViewRegion(regionId: string, user?: SessionUser): Promise<void> {
  const currentUser = user ?? (await getCurrentUser());
  if (currentUser.role === Role.ADMIN || currentUser.role === Role.EVENT) return;
  if (currentUser.role === Role.KEPALA_REGION && currentUser.regionId === regionId) return;
  throw new ForbiddenError();
}

/**
 * Resolves the set of unit ids the current user is allowed to see data
 * for. Returns the literal "ALL" for Admin rather than every unit id, so
 * callers can special-case a global query instead of passing a huge
 * `in: [...]` list.
 */
export async function getScopedUnitIds(user?: SessionUser): Promise<string[] | "ALL"> {
  const currentUser = user ?? (await getCurrentUser());

  // EVENT judges Terkompak/Throne Battle across every region, same reach as
  // Admin for read purposes — it just can't reach Admin-only actions
  // (assertCanManageMasterData/assertCanImport/assertCanFinalize stay ADMIN-only).
  if (currentUser.role === Role.ADMIN || currentUser.role === Role.EVENT) return "ALL";

  if (currentUser.role === Role.KEPALA_REGION) {
    if (!currentUser.regionId) return [];
    const units = await prisma.unit.findMany({
      where: { regionId: currentUser.regionId },
      select: { id: true },
    });
    return units.map((u) => u.id);
  }

  if ((currentUser.role === Role.MENTOR || currentUser.role === Role.DAMEN) && currentUser.unitId) {
    return [currentUser.unitId];
  }

  return [];
}
