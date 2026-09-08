import "server-only";
import { prisma } from "@/lib/prisma";

export type UnitProgress = {
  unitId: string;
  unitCode: string;
  unitName: string;
  mentorId: string | null;
  mentorName: string | null;
  mentorNrp: string | null;
  mentorPhone: string | null;
  mabaCount: number;
  attendanceDoneCount: number;
  attendanceTotalCount: number;
  scoringDoneCount: number;
  scoringTotalCount: number;
  attPct: number;
  scorePct: number;
  isComplete: boolean;
};

/**
 * Single source of truth for "is a unit's attendance+scoring input complete
 * (across all activities)" — the same composite rule the Tracking Unit page
 * (components/admin/unit-tracking-matrix.tsx) uses to badge a unit
 * Lengkap/Proses/Belum: attendance AND scoring both effectively 100%,
 * scoring exempted when a unit has zero scoreable parameters. Used by the
 * reminder feature (manual button, bulk send, and the automatic cron) so
 * "belum lengkap" never drifts from what admin already sees on that page.
 *
 * This intentionally only computes the "ALL activities" aggregate, not the
 * per-activity breakdown that page also shows — reminders nudge a mentor
 * about the unit as a whole, not one activity at a time.
 */
export async function getUnitProgressList(): Promise<UnitProgress[]> {
  const activities = await prisma.activity.findMany({
    where: { active: true },
    include: {
      sessions: { select: { id: true, code: true } },
      materials: {
        where: { active: true },
        include: { parameters: { where: { active: true }, select: { id: true } } },
      },
    },
  });

  const realSessionIds = new Set<string>();
  const paramIds = new Set<string>();
  for (const act of activities) {
    for (const s of act.sessions) {
      if (s.code !== "UMUM") realSessionIds.add(s.id);
    }
    for (const mat of act.materials) {
      for (const p of mat.parameters) paramIds.add(p.id);
    }
  }
  const totalRealSessions = realSessionIds.size;
  const totalParams = paramIds.size;
  const realSessionIdList = Array.from(realSessionIds);
  const paramIdList = Array.from(paramIds);

  const units = await prisma.unit.findMany({
    orderBy: { code: "asc" },
    include: {
      mentor: { select: { id: true, name: true, nrp: true, phone: true } },
      students: {
        where: { active: true },
        select: {
          id: true,
          attendances: { where: { sessionId: { in: realSessionIdList } }, select: { id: true } },
          scores: { where: { value: { not: null }, parameterId: { in: paramIdList } }, select: { id: true } },
        },
      },
    },
  });

  return units.map((unit) => {
    const mabaCount = unit.students.length;
    const attendanceTotalCount = mabaCount * totalRealSessions;
    const scoringTotalCount = mabaCount * totalParams;
    let attendanceDoneCount = 0;
    let scoringDoneCount = 0;
    for (const st of unit.students) {
      attendanceDoneCount += st.attendances.length;
      scoringDoneCount += st.scores.length;
    }
    const attPct = attendanceTotalCount > 0 ? Math.round((attendanceDoneCount / attendanceTotalCount) * 100) : 0;
    const scorePct = scoringTotalCount > 0 ? Math.round((scoringDoneCount / scoringTotalCount) * 100) : 0;
    const isComplete = attPct >= 100 && (scoringTotalCount === 0 || scorePct >= 100);

    return {
      unitId: unit.id,
      unitCode: unit.code,
      unitName: unit.name,
      mentorId: unit.mentor?.id ?? null,
      mentorName: unit.mentor?.name ?? null,
      mentorNrp: unit.mentor?.nrp ?? null,
      mentorPhone: unit.mentor?.phone ?? null,
      mabaCount,
      attendanceDoneCount,
      attendanceTotalCount,
      scoringDoneCount,
      scoringTotalCount,
      attPct,
      scorePct,
      isComplete,
    };
  });
}
