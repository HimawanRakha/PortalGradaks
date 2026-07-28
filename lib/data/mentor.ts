import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/dal";
import type { SessionUser } from "@/lib/auth/dal";
import { InputMethod } from "@/app/generated/prisma/enums";

/**
 * The only InputMethods that produce a per-student Score row. GROUP produces
 * a GroupScore instead (one value per Group, not per student); UNIT_MENTOR/
 * UNIT_EVENT/REGION_EVENT belong to the Inclenation event scoreboard
 * (UnitEventScore/RegionEventScore) and never touch Score at all — see
 * lib/scoring/event-calculate.ts. An allow-list (rather than "not GROUP") so
 * a future InputMethod defaults to excluded here unless explicitly added.
 */
export const PER_STUDENT_INPUT_METHODS: InputMethod[] = [InputMethod.MENTOR, InputMethod.IMPORT];

/**
 * The session JWT freezes unitId at sign-in time and never re-validates it
 * against the DB (see auth.ts's jwt callback — it only reads from `user`
 * on initial sign-in). If the unit that id pointed to gets deleted and
 * recreated with a new id (a reseed, or an admin reassigning the mentor),
 * every request from an already-signed-in session would otherwise crash
 * here with an unhandled Prisma P2025. Fail soft instead: this is
 * functionally an invalid/stale session, so send them back to sign in
 * fresh rather than showing a raw error page.
 */
export async function requireMentorUnit(user: SessionUser) {
  if (!user.unitId) throw new ForbiddenError("Akun ini belum ditautkan ke unit manapun.");
  const unit = await prisma.unit.findUnique({
    where: { id: user.unitId },
    include: { region: true, students: { orderBy: { name: "asc" } } },
  });
  if (!unit) redirect("/api/auth/force-logout");
  return unit;
}

export async function getActivitiesOverview() {
  return prisma.activity.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: {
      materials: { where: { active: true }, orderBy: { order: "asc" }, include: { parameters: { where: { active: true } } } },
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
    const scorableParams = activity.materials
      .flatMap((m) => m.parameters)
      .filter((p) => PER_STUDENT_INPUT_METHODS.includes(p.inputMethod));
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
    where: { activity: { code: activityCode }, active: true },
    orderBy: { order: "asc" },
    include: { parameters: { where: { active: true }, orderBy: { order: "asc" } } },
  });
}

export async function getUmumSession(activityCode: string) {
  const session = await prisma.activitySession.findFirst({
    where: { activity: { code: activityCode }, code: "UMUM" },
  });
  if (session) return session;

  const activity = await prisma.activity.findUnique({ where: { code: activityCode } });
  if (!activity) {
    throw new Error(`Kegiatan dengan kode "${activityCode}" tidak ditemukan.`);
  }

  return prisma.activitySession.create({
    data: {
      activityId: activity.id,
      code: "UMUM",
      name: "Umum",
      mode: "NA",
    },
  });
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

/** Existing UNIT_MENTOR values (Teraktif/Terdisiplin/Pelanggaran) for one unit, keyed by parameterId. */
export async function getUnitEventScores(unitId: string): Promise<Map<string, number | null>> {
  const rows = await prisma.unitEventScore.findMany({ where: { unitId } });
  return new Map(rows.map((r) => [r.parameterId, r.value]));
}
