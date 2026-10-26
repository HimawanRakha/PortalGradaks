import "server-only";
import { prisma } from "@/lib/prisma";
import { AttendanceCategory, AttendanceStatus } from "@/app/generated/prisma/enums";

export type AttendanceEntry = {
  sessionId: string;
  activityName: string;
  sessionCode: string;
  sessionName: string;
  /** null = the session hasn't been held / imported yet for anyone. */
  status: AttendanceStatus | null;
  /** Status inferred from imported quiz scores (Activity.attendanceFromScores). */
  derivedFromScores: boolean;
  participationScore: number | null;
  skillCategory: string | null;
};

export type AttendanceSection = {
  category: AttendanceCategory;
  label: string;
  entries: AttendanceEntry[];
  totalSessions: number;
  /** Sessions with any data cohort-wide — only these count toward score/gate. */
  heldCount: number;
  attendedCount: number;
  /** IZIN + ALPA among held sessions. */
  absences: number;
  /** Null = this section has no "Tidak Layak Diagregasi" gate. */
  maxAbsences: number | null;
  /** totalSessions - maxAbsences, for the progress display. */
  minAttendance: number | null;
  /** Average status score (0-100) over held sessions; null when none held. */
  score: number | null;
  eligible: boolean;
  /**
   * Kegiatan Keahlian only: skill categories (M/K/MB/KW) that have at least
   * one kegiatan with data cohort-wide — only those can count as "not
   * attended = 0"; a category with no kegiatan yet can't penalize anyone.
   */
  heldSkillCategories: string[];
};

export const ATTENDANCE_SECTION_LABELS: Record<AttendanceCategory, string> = {
  INCLENATION: "Inclenation",
  TEMU_FTEIC: "Temu FTEIC",
  KEGIATAN_BESAR: "Kegiatan Besar",
  KEAHLIAN: "Kegiatan Keahlian",
};

const SECTION_ORDER: AttendanceCategory[] = [
  AttendanceCategory.INCLENATION,
  AttendanceCategory.TEMU_FTEIC,
  AttendanceCategory.KEGIATAN_BESAR,
  AttendanceCategory.KEAHLIAN,
];

type AttendanceSessionRow = {
  id: string;
  code: string;
  name: string;
  skillCategory: string | null;
  activity: { id: string; name: string; order: number; attendanceCategory: AttendanceCategory | null; attendanceFromScores: boolean };
};

/** Everything about the attendance sessions that's the same for every student. */
export type AttendanceContext = {
  sessions: AttendanceSessionRow[];
  /** Sessions with any Attendance row cohort-wide (= held / imported). */
  heldSet: Set<string>;
  /** attendanceFromScores activities where anyone has a score > 0 (= held). */
  derivedHeldSet: Set<string>;
  /** parameterId → activityId, for the attendanceFromScores activities. */
  derivedParamActivity: Map<string, string>;
  statusScores: Record<string, number>;
  temuMaxAbsences: number;
  kegiatanBesarMaxAbsences: number;
};

export type StudentAttendanceRow = { sessionId: string; status: AttendanceStatus; participationScore: number | null };

/**
 * Sessions are picked by Activity.attendanceCategory, deliberately ignoring
 * Activity.active — PSDM deactivates import-only activities just to hide
 * them from mentors, and they must still count here.
 */
export async function loadAttendanceContext(opts: {
  statusScores: Record<string, number>;
  temuMaxAbsences: number;
  kegiatanBesarMaxAbsences: number;
}): Promise<AttendanceContext> {
  const sessions = await prisma.activitySession.findMany({
    where: { activity: { attendanceCategory: { not: null } }, code: { not: "UMUM" } },
    select: {
      id: true,
      code: true,
      name: true,
      skillCategory: true,
      activity: { select: { id: true, name: true, order: true, attendanceCategory: true, attendanceFromScores: true } },
    },
    orderBy: [{ activity: { order: "asc" } }, { code: "asc" }],
  });
  const sessionIds = sessions.map((s) => s.id);
  const derivedActivityIds = [...new Set(sessions.filter((s) => s.activity.attendanceFromScores).map((s) => s.activity.id))];

  const [heldGroups, derivedHeld, derivedParams] = await Promise.all([
    prisma.attendance.groupBy({ by: ["sessionId"], where: { sessionId: { in: sessionIds } } }),
    Promise.all(
      derivedActivityIds.map(async (activityId) => ({
        activityId,
        any: !!(await prisma.score.findFirst({
          where: { value: { gt: 0 }, parameter: { material: { activityId } } },
          select: { id: true },
        })),
      })),
    ),
    prisma.parameter.findMany({
      where: { material: { activityId: { in: derivedActivityIds } } },
      select: { id: true, material: { select: { activityId: true } } },
    }),
  ]);

  return {
    sessions,
    heldSet: new Set(heldGroups.map((g) => g.sessionId)),
    derivedHeldSet: new Set(derivedHeld.filter((d) => d.any).map((d) => d.activityId)),
    derivedParamActivity: new Map(derivedParams.map((p) => [p.id, p.material.activityId])),
    ...opts,
  };
}

/**
 * Builds the four raport attendance sections for one student from preloaded
 * data — no queries, so it's cheap to run for the whole cohort.
 *
 * A session nobody has data for yet (not held / not imported) is shown as
 * pending and excluded from both the score and the absence gate, so an
 * upcoming Arus Emas doesn't mark the whole cohort "tidak layak" early.
 * Kegiatan Keahlian is optional: only sessions the student has a row for are
 * listed, and it never gates.
 */
export function buildAttendanceSections(
  ctx: AttendanceContext,
  attendances: StudentAttendanceRow[],
  /** attendanceFromScores activities where this student has a score > 0. */
  derivedAttendedSet: Set<string>,
): AttendanceSection[] {
  const { sessions, heldSet, derivedHeldSet } = ctx;
  const opts = ctx;
  const attMap = new Map(attendances.map((a) => [a.sessionId, a]));
  const scoreOf = (status: AttendanceStatus) => opts.statusScores[status] ?? 0;

  return SECTION_ORDER.map((category) => {
    const entries: AttendanceEntry[] = [];
    for (const s of sessions) {
      if (s.activity.attendanceCategory !== category) continue;
      const att = attMap.get(s.id);
      let status: AttendanceStatus | null = null;
      let derivedFromScores = false;

      if (att) {
        status = att.status;
      } else if (s.activity.attendanceFromScores && derivedHeldSet.has(s.activity.id)) {
        status = derivedAttendedSet.has(s.activity.id) ? AttendanceStatus.HADIR : AttendanceStatus.ALPA;
        derivedFromScores = true;
      } else if (heldSet.has(s.id)) {
        status = AttendanceStatus.ALPA; // held for others, no row for this student
      }

      // Optional kegiatan: list only what this student actually has a row for.
      if (category === AttendanceCategory.KEAHLIAN && !att) continue;

      entries.push({
        sessionId: s.id,
        activityName: s.activity.name,
        sessionCode: s.code,
        sessionName: s.name,
        status,
        derivedFromScores,
        participationScore: att?.participationScore ?? null,
        skillCategory: s.skillCategory,
      });
    }

    const held = entries.filter((e) => e.status !== null);
    const attendedCount = held.filter((e) => e.status === AttendanceStatus.HADIR).length;
    const absences = held.length - attendedCount;
    const maxAbsences =
      category === AttendanceCategory.TEMU_FTEIC
        ? opts.temuMaxAbsences
        : category === AttendanceCategory.KEGIATAN_BESAR
          ? opts.kegiatanBesarMaxAbsences
          : null;
    const score =
      category === AttendanceCategory.KEAHLIAN || held.length === 0
        ? null
        : Number((held.reduce((sum, e) => sum + scoreOf(e.status!), 0) / held.length).toFixed(3));

    return {
      category,
      label: ATTENDANCE_SECTION_LABELS[category],
      entries,
      totalSessions: entries.length,
      heldCount: held.length,
      attendedCount,
      absences,
      maxAbsences,
      minAttendance: maxAbsences === null ? null : Math.max(0, entries.length - maxAbsences),
      score,
      eligible: maxAbsences === null || absences <= maxAbsences,
      heldSkillCategories:
        category === AttendanceCategory.KEAHLIAN
          ? [
              ...new Set(
                sessions
                  .filter((s) => s.activity.attendanceCategory === category && heldSet.has(s.id) && s.skillCategory)
                  .map((s) => s.skillCategory!),
              ),
            ]
          : [],
    };
  });
}
