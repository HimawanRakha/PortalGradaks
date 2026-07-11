import "server-only";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";

/**
 * Master Data is the one place PSDM edits "everything that can change" —
 * activities/materials/parameters/schedule/accounts/weights — without a
 * code change. These helpers are read-only fetches shared across the
 * six admin/master-data sub-pages; mutations live in each section's own
 * actions.ts (kept separate so concurrent agents never collide on one file).
 */

/** Prisma's Decimal fields (personalWeight/skillWeight/quorumThresholdPct)
 * are class instances — passing them straight from a Server Component into
 * a "use client" component as a prop throws at runtime ("Only plain
 * objects... can be passed to Client Components"). Always route Decimal
 * values through this before handing them to a client component. */
export function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export async function getActivitiesWithCounts() {
  return prisma.activity.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { sessions: true, materials: true } },
    },
  });
}

export async function getActivityWithSessions(activityId: string) {
  return prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    include: { sessions: { orderBy: { code: "asc" } } },
  });
}

export async function getActivitiesWithSessions() {
  return prisma.activity.findMany({
    orderBy: { order: "asc" },
    include: { sessions: { orderBy: { code: "asc" } } },
  });
}

export async function getActivityOptions() {
  return prisma.activity.findMany({
    orderBy: { order: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function getMaterialsWithActivity(activityId?: string) {
  return prisma.material.findMany({
    where: activityId ? { activityId } : undefined,
    orderBy: [{ activity: { order: "asc" } }, { order: "asc" }],
    include: {
      activity: { select: { id: true, code: true, name: true } },
      _count: { select: { parameters: true } },
    },
  });
}

export async function getMaterialOptions(activityId?: string) {
  return prisma.material.findMany({
    where: activityId ? { activityId } : undefined,
    orderBy: { order: "asc" },
    select: { id: true, code: true, name: true, activityId: true },
  });
}

export async function getParametersWithMaterial(materialId?: string, activityId?: string) {
  return prisma.parameter.findMany({
    where: materialId ? { materialId } : activityId ? { material: { activityId } } : undefined,
    orderBy: [{ material: { activity: { order: "asc" } } }, { material: { order: "asc" } }, { order: "asc" }],
    include: {
      material: {
        select: { id: true, code: true, name: true, activityId: true, activity: { select: { id: true, code: true, name: true } } },
      },
    },
  });
}

export async function getSessionsForSchedule(activityId?: string) {
  return prisma.activitySession.findMany({
    where: activityId ? { activityId } : undefined,
    orderBy: [{ activity: { order: "asc" } }, { code: "asc" }],
    include: { activity: { select: { id: true, code: true, name: true } } },
  });
}

export async function getRegionOptions() {
  return prisma.region.findMany({ orderBy: { code: "asc" } });
}

export async function getUnitOptionsWithMentor() {
  return prisma.unit.findMany({
    orderBy: [{ region: { code: "asc" } }, { code: "asc" }],
    include: { region: { select: { id: true, code: true, name: true } }, mentor: { select: { id: true, name: true } } },
  });
}

export async function getAllAccounts(role?: Role) {
  return prisma.user.findMany({
    where: role ? { role } : undefined,
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: {
      region: { select: { id: true, code: true, name: true } },
      unit: { select: { id: true, code: true, name: true } },
    },
  });
}

export async function getMasterDataOverviewCounts() {
  const [activityCount, sessionCount, unscheduledSessionCount, materialCount, parameterActiveCount, parameterTotalCount, userActiveCount, userTotalCount, settingCount] =
    await Promise.all([
      prisma.activity.count(),
      prisma.activitySession.count(),
      prisma.activitySession.count({ where: { scheduledAt: null, code: { not: "UMUM" } } }),
      prisma.material.count(),
      prisma.parameter.count({ where: { active: true } }),
      prisma.parameter.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.user.count(),
      prisma.setting.count(),
    ]);

  return {
    activityCount,
    sessionCount,
    unscheduledSessionCount,
    materialCount,
    parameterActiveCount,
    parameterTotalCount,
    userActiveCount,
    userTotalCount,
    settingCount,
  };
}
