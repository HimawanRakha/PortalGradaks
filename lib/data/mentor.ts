import "server-only";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/dal";
import type { SessionUser } from "@/lib/auth/dal";

export async function requireMentorUnit(user: SessionUser) {
  if (!user.unitId) throw new ForbiddenError("Akun ini belum ditautkan ke unit manapun.");
  const unit = await prisma.unit.findUniqueOrThrow({
    where: { id: user.unitId },
    include: { region: true, students: { orderBy: { name: "asc" } } },
  });
  return unit;
}

export async function getActivitiesOverview() {
  return prisma.activity.findMany({
    orderBy: { order: "asc" },
    include: {
      materials: { orderBy: { order: "asc" }, include: { parameters: { where: { active: true } } } },
      sessions: { orderBy: { code: "asc" } },
    },
  });
}

/** Per-activity completion snapshot for one unit's students — powers the mentor home progress rings. */
export async function getUnitProgress(unitId: string) {
  const [unit, activities] = await Promise.all([
    prisma.unit.findUniqueOrThrow({ where: { id: unitId }, include: { students: true } }),
    getActivitiesOverview(),
  ]);

  const studentIds = unit.students.map((s) => s.id);
  if (studentIds.length === 0) {
    return activities.map((activity) => ({ activity, done: 0, total: 0 }));
  }

  const results = [];
  for (const activity of activities) {
    const scorableParams = activity.materials.flatMap((m) => m.parameters).filter((p) => p.inputMethod !== "GROUP");
    const total = scorableParams.length * studentIds.length;
    if (total === 0) {
      results.push({ activity, done: 0, total: 0 });
      continue;
    }
    const done = await prisma.score.count({
      where: {
        studentId: { in: studentIds },
        parameterId: { in: scorableParams.map((p) => p.id) },
        value: { not: null },
      },
    });
    results.push({ activity, done, total });
  }
  return results;
}

export async function getMaterialsForActivity(activityCode: string) {
  return prisma.material.findMany({
    where: { activity: { code: activityCode } },
    orderBy: { order: "asc" },
    include: { parameters: { where: { active: true }, orderBy: { order: "asc" } } },
  });
}

export async function getUmumSession(activityCode: string) {
  return prisma.activitySession.findFirstOrThrow({ where: { activity: { code: activityCode }, code: "UMUM" } });
}

export async function getRealSessions(activityCode: string) {
  return prisma.activitySession.findMany({
    where: { activity: { code: activityCode }, code: { not: "UMUM" } },
    orderBy: { code: "asc" },
  });
}

export async function getScoresForSession(studentIds: string[], parameterIds: string[], sessionId: string) {
  const scores = await prisma.score.findMany({
    where: { studentId: { in: studentIds }, parameterId: { in: parameterIds }, sessionId },
  });
  const map = new Map<string, Map<string, number | null>>();
  for (const score of scores) {
    if (!map.has(score.studentId)) map.set(score.studentId, new Map());
    map.get(score.studentId)!.set(score.parameterId, score.value);
  }
  return map;
}

export async function getAttendanceForSession(studentIds: string[], sessionId: string) {
  const rows = await prisma.attendance.findMany({ where: { studentId: { in: studentIds }, sessionId } });
  return new Map(rows.map((r) => [r.studentId, r]));
}

export async function getGroupsForMaterial(unitId: string, materialId: string) {
  return prisma.group.findMany({
    where: { unitId, materialId },
    include: { members: { include: { student: true } }, groupScores: true },
    orderBy: { name: "asc" },
  });
}
