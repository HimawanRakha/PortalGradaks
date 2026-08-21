import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, LogbookStatus } from "@/app/generated/prisma/enums";
import { UnitTrackingMatrix, UnitTrackingItem, StudentTrackingInfo } from "@/components/admin/unit-tracking-matrix";

export const metadata: Metadata = { title: "Tracking Presensi & Nilai Unit - Admin" };

export default async function AdminUnitTrackingPage() {
  await assertRole(Role.ADMIN);

  // 1. Fetch activities with sessions & materials/parameters
  const activities = await prisma.activity.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: {
      sessions: { select: { id: true, code: true, name: true } },
      materials: {
        where: { active: true },
        include: {
          parameters: {
            where: { active: true },
            select: { id: true, materialId: true },
          },
        },
      },
    },
  });

  const regions = await prisma.region.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  // Map activity code -> list of real sessions, session IDs and parameter IDs
  const activityMap = new Map<
    string,
    {
      realSessions: { id: string; code: string; name: string }[];
      realSessionIds: Set<string>;
      paramIds: Set<string>;
      totalParams: number;
    }
  >();

  for (const act of activities) {
    const realSessions = act.sessions
      .filter((s) => s.code !== "UMUM")
      .map((s) => ({ id: s.id, code: s.code, name: s.name }));
    const realSessionIds = new Set(realSessions.map((s) => s.id));
    const paramIds = new Set<string>();
    for (const mat of act.materials) {
      for (const p of mat.parameters) {
        paramIds.add(p.id);
      }
    }
    activityMap.set(act.code, {
      realSessions,
      realSessionIds,
      paramIds,
      totalParams: paramIds.size,
    });
  }

  // 2. Fetch all units with mentor and students
  const unitsData = await prisma.unit.findMany({
    orderBy: { code: "asc" },
    include: {
      region: { select: { id: true, code: true, name: true } },
      mentor: { select: { name: true, nrp: true } },
      students: {
        where: { active: true },
        select: {
          id: true,
          name: true,
          nrp: true,
          attendances: {
            select: { sessionId: true, status: true, participationScore: true },
          },
          scores: {
            where: { value: { not: null } },
            select: { parameterId: true, sessionId: true },
          },
          logbookEntries: {
            where: { status: LogbookStatus.BELUM_DIVERIFIKASI },
            select: { id: true },
          },
        },
      },
    },
  });

  // 3. Process each unit to calculate metrics per activity
  const processedUnits: UnitTrackingItem[] = unitsData.map((unit) => {
    const mabaCount = unit.students.length;

    const activityMetrics: UnitTrackingItem["activityMetrics"] = {};
    let overallAttDone = 0;
    let overallAttTotal = 0;
    let overallScoreDone = 0;
    let overallScoreTotal = 0;

    // Precalculate activityMetrics structure
    for (const act of activities) {
      const info = activityMap.get(act.code)!;
      const attTotalForAct = mabaCount * info.realSessions.length;
      activityMetrics[act.code] = {
        attendanceDoneCount: 0,
        attendanceTotalCount: attTotalForAct,
        scoringDoneCount: 0,
        scoringTotalCount: info.totalParams * mabaCount,
      };
      overallAttTotal += attTotalForAct;
      overallScoreTotal += info.totalParams * mabaCount;
    }

    const processedStudents: StudentTrackingInfo[] = unit.students.map((st) => {
      const attendanceByActivity: StudentTrackingInfo["attendanceByActivity"] = {};
      const scoresCountByActivity: Record<string, number> = {};
      const totalParamsByActivity: Record<string, number> = {};

      for (const act of activities) {
        const info = activityMap.get(act.code)!;
        totalParamsByActivity[act.code] = info.totalParams;

        // Collect attendance status for all real sessions in this activity
        const sessionAtts = info.realSessions.map((s) => {
          const att = st.attendances.find((a) => a.sessionId === s.id);
          if (att) {
            activityMetrics[act.code].attendanceDoneCount += 1;
            overallAttDone += 1;
          }
          return {
            sessionId: s.id,
            sessionCode: s.code,
            sessionName: s.name,
            status: att?.status || null,
            participationScore: att?.participationScore ?? null,
          };
        });
        attendanceByActivity[act.code] = sessionAtts;

        // Count scores entered for parameters in this activity
        const scoredParams = st.scores.filter((sc) => info.paramIds.has(sc.parameterId)).length;
        scoresCountByActivity[act.code] = scoredParams;
        activityMetrics[act.code].scoringDoneCount += scoredParams;
        overallScoreDone += scoredParams;
      }

      return {
        id: st.id,
        name: st.name,
        nrp: st.nrp,
        attendanceByActivity,
        scoresCountByActivity,
        totalParamsByActivity,
        unverifiedLogbooks: st.logbookEntries.length,
      };
    });

    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      regionId: unit.region.id,
      regionCode: unit.region.code,
      regionName: unit.region.name,
      mentorName: unit.mentor?.name || null,
      mentorNrp: unit.mentor?.nrp || null,
      mabaCount,
      students: processedStudents,
      activityMetrics,
      overallMetrics: {
        attendanceDoneCount: overallAttDone,
        attendanceTotalCount: overallAttTotal,
        scoringDoneCount: overallScoreDone,
        scoringTotalCount: overallScoreTotal,
      },
    };
  });

  const defaultActivityCode = activities[0]?.code || "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tracking Presensi & Pengisian Nilai Unit</h2>
        <p className="text-xs text-muted-foreground">
          Monitoring tingkat penyelesaian presensi maba dan pengisian nilai oleh mentor per unit dan per kegiatan.
        </p>
      </div>

      <UnitTrackingMatrix
        activities={activities.map((a) => {
          const info = activityMap.get(a.code)!;
          return {
            id: a.id,
            code: a.code,
            name: a.name,
            sessions: info.realSessions,
          };
        })}
        regions={regions}
        units={processedUnits}
        defaultActivityCode={defaultActivityCode}
      />
    </div>
  );
}
