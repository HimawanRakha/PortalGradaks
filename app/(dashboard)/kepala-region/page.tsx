import type { Metadata } from "next";
import Link from "next/link";
import { Users, BookOpenCheck, Flag, CheckCircle, Scale } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, LogbookStatus, FlagStatus } from "@/app/generated/prisma/enums";
import { StatCard } from "@/components/dashboard/stat-card";
import { AutoSubmitSelect } from "@/components/scoring/auto-submit-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata: Metadata = { title: "Beranda Region - Kepala Region" };

export default async function RegionHomePage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string }>;
}) {
  const user = await assertRole(Role.KEPALA_REGION, Role.ADMIN);
  if (!user.regionId) {
    throw new Error("Akun Anda belum ditautkan ke wilayah region mana pun.");
  }

  const { activity: activityParam } = await searchParams;

  // Fetch region info & activities
  const [region, activities] = await Promise.all([
    prisma.region.findUniqueOrThrow({
      where: { id: user.regionId },
      include: {
        units: {
          orderBy: { code: "asc" },
          include: {
            mentor: { select: { id: true, name: true, nrp: true } },
            students: { select: { id: true } },
          },
        },
      },
    }),
    prisma.activity.findMany({ orderBy: { order: "asc" } }),
  ]);

  const selectedActivity = activities.find((act) => act.code === activityParam) || activities[0];
  const activityCode = selectedActivity?.code;

  // Retrieve parameters and sessions for the selected activity to compute completeness
  const [parameters, sessions] = await Promise.all([
    prisma.parameter.findMany({
      where: { material: { activity: { code: activityCode } }, active: true },
      select: { id: true },
    }),
    prisma.activitySession.findMany({
      where: { activity: { code: activityCode }, code: { not: "UMUM" } },
      select: { id: true },
    }),
  ]);

  // Aggregate stats across all units in the region
  const unitIds = region.units.map((u) => u.id);
  const mabaCount = region.units.reduce((sum, u) => sum + u.students.length, 0);

  const [pendingLogbooks, openFlags] = await Promise.all([
    prisma.logbookEntry.count({
      where: { student: { unitId: { in: unitIds } }, status: LogbookStatus.BELUM_DIVERIFIKASI },
    }),
    prisma.flag.count({
      where: { unitId: { in: unitIds }, status: FlagStatus.OPEN },
    }),
  ]);

  // Calculate detailed progress metrics for each unit in the region
  const unitMatrix = await Promise.all(
    region.units.map(async (unit) => {
      const studentIds = unit.students.map((s) => s.id);
      
      let scoringPct = 0;
      let attendancePct = 0;
      let logbookPct = 0;

      if (studentIds.length > 0) {
        // 1. Scoring Progress
        const scoringTotal = parameters.length * studentIds.length;
        if (scoringTotal > 0) {
          const scoringDone = await prisma.score.count({
            where: {
              studentId: { in: studentIds },
              parameterId: { in: parameters.map((p) => p.id) },
              value: { not: null },
            },
          });
          scoringPct = Math.round((scoringDone / scoringTotal) * 100);
        }

        // 2. Attendance Progress
        const attendanceTotal = sessions.length * studentIds.length;
        if (attendanceTotal > 0) {
          const attendanceDone = await prisma.attendance.count({
            where: {
              studentId: { in: studentIds },
              sessionId: { in: sessions.map((s) => s.id) },
            },
          });
          attendancePct = Math.round((attendanceDone / attendanceTotal) * 100);
        }

        // 3. Logbook Progress
        const logbookTotal = await prisma.logbookEntry.count({
          where: { studentId: { in: studentIds } },
        });
        if (logbookTotal > 0) {
          const logbookDone = await prisma.logbookEntry.count({
            where: { studentId: { in: studentIds }, status: { not: LogbookStatus.BELUM_DIVERIFIKASI } },
          });
          logbookPct = Math.round((logbookDone / logbookTotal) * 100);
        }
      }

      // Counts for this specific unit
      const [unitPendingLogbooks, unitOpenFlags] = await Promise.all([
        prisma.logbookEntry.count({
          where: { student: { unitId: unit.id }, status: LogbookStatus.BELUM_DIVERIFIKASI },
        }),
        prisma.flag.count({
          where: { unitId: unit.id, status: FlagStatus.OPEN },
        }),
      ]);

      return {
        ...unit,
        scoringPct,
        attendancePct,
        logbookPct,
        pendingLogbooks: unitPendingLogbooks,
        openFlags: unitOpenFlags,
      };
    }),
  );

  const filterOptions = activities.map((act) => ({
    value: act.code,
    label: act.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Wilayah Region: {region.name}</h2>
          <p className="text-sm text-muted-foreground">Kepala Region Dashboard — Memantau 10 Unit Mentoring.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total Mahasiswa Baru" value={mabaCount} icon={Users} />
        <StatCard
          label="Logbook Menunggu Verifikasi"
          value={pendingLogbooks}
          icon={BookOpenCheck}
          tone={pendingLogbooks > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Flag Eskalasi Aktif"
          value={openFlags}
          icon={Flag}
          tone={openFlags > 0 ? "danger" : "default"}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
          <div>
            <CardTitle className="text-base">Matriks Kelengkapan Pengisian Unit</CardTitle>
            <CardDescription className="text-xs">
              Persentase pengisian nilai dan kehadiran untuk kegiatan terpilih.
            </CardDescription>
          </div>
          <form method="GET" action="/kepala-region">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Kegiatan:</span>
              <AutoSubmitSelect
                name="activity"
                defaultValue={selectedActivity?.code || ""}
                options={filterOptions}
              />
            </div>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                  <th className="p-3">Unit</th>
                  <th className="p-3">Mentor</th>
                  <th className="p-3">Scoring Nilai ({selectedActivity?.name})</th>
                  <th className="p-3">Presensi Sesi</th>
                  <th className="p-3">Logbook Diverifikasi</th>
                  <th className="p-3">Status Isu</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {unitMatrix.map((unit) => (
                  <tr key={unit.id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold">
                      <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] mr-1.5 border border-primary/20">
                        {unit.code}
                      </span>
                      {unit.name}
                    </td>
                    <td className="p-3">
                      {unit.mentor ? (
                        <div>
                          <p className="font-medium">{unit.mentor.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{unit.mentor.nrp}</p>
                        </div>
                      ) : (
                        <span className="text-red-500 font-medium">Belum ditautkan</span>
                      )}
                    </td>
                    <td className="p-3 w-56">
                      {unit.students.length === 0 ? (
                        <span className="text-muted-foreground">Tidak ada maba</span>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>Progress</span>
                            <span>{unit.scoringPct}%</span>
                          </div>
                          <Progress value={unit.scoringPct} className="h-1.5" />
                        </div>
                      )}
                    </td>
                    <td className="p-3 w-40">
                      {unit.students.length === 0 ? (
                        "-"
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>Kehadiran</span>
                            <span>{unit.attendancePct}%</span>
                          </div>
                          <Progress value={unit.attendancePct} className="h-1.5" />
                        </div>
                      )}
                    </td>
                    <td className="p-3 w-40">
                      {unit.students.length === 0 ? (
                        "-"
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>Terverifikasi</span>
                            <span>{unit.logbookPct}%</span>
                          </div>
                          <Progress value={unit.logbookPct} className="h-1.5" />
                          {unit.pendingLogbooks > 0 && (
                            <span className="text-[10px] text-amber-500 font-medium block">
                              {unit.pendingLogbooks} menunggu verifikasi
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {unit.openFlags > 0 ? (
                        <Link href="/kepala-region/escalation" className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive hover:underline bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20">
                          <Flag className="size-3" />
                          {unit.openFlags} Eskalasi
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                          <CheckCircle className="size-3" /> Clean
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
