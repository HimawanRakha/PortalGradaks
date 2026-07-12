import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";

export type SessionUser = {
  id: string;
  nrp: string;
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
 */
export const verifySession = cache(async (): Promise<{ user: SessionUser }> => {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return { user: session.user as SessionUser };
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

/**
 * Mentor scope = own unit only; Kepala Region scope = own region's units;
 * Admin = global. Centralized here so no page/action re-derives scope
 * logic independently.
 */
export async function assertCanViewUnit(unitId: string, user?: SessionUser): Promise<void> {
  const currentUser = user ?? (await getCurrentUser());
  if (currentUser.role === Role.ADMIN) return;

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
  if (currentUser.role === Role.ADMIN) return;
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

  if (currentUser.role === Role.ADMIN) return "ALL";

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
