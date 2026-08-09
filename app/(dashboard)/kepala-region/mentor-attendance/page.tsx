import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { getActivitiesOverview, getRealSessions } from "@/lib/data/mentor";
import { AutoSubmitSelect } from "@/components/scoring/auto-submit-select";
import { AttendanceGrid } from "@/components/scoring/attendance-grid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveMentorAttendanceAction } from "@/app/(dashboard)/kepala-region/actions";

export const metadata: Metadata = { title: "Presensi Mentor" };

export default async function MentorAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; session?: string; regionId?: string; departmentId?: string }>;
}) {
  const user = await assertRole(Role.KEPALA_REGION, Role.ADMIN);
  const isAdmin = user.role === Role.ADMIN;
  const { activity, session, regionId = "ALL", departmentId = "ALL" } = await searchParams;

  if (!isAdmin && !user.regionId) {
    throw new Error("Akun Anda belum ditautkan ke wilayah region mana pun.");
  }

  // Fetch all regions for Region filter dropdown (Admin view)
  const allRegions = isAdmin ? await prisma.region.findMany({ orderBy: { code: "asc" } }) : [];
  const regionOptions = [
    { value: "ALL", label: "Semua Region" },
    ...allRegions.map((r) => ({ value: r.id, label: `Region ${r.code} (${r.name})` })),
  ];

  // Fetch all departments for Department filter dropdown
  const allDepartments = await prisma.department.findMany({ orderBy: { code: "asc" } });
  const departmentOptions = [
    { value: "ALL", label: "Semua Departemen" },
    ...allDepartments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
  ];

  // 1. Mentors in scope: own region for KR, filtered region for Admin.
  const regions = await prisma.region.findMany({
    where: isAdmin
      ? (regionId !== "ALL" ? { id: regionId } : {})
      : { id: user.regionId! },
    orderBy: { code: "asc" },
    include: {
      units: {
        orderBy: { code: "asc" },
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
              nrp: true,
              departmentId: true,
              department: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  });
  // Session's regionId is frozen at sign-in — if the region was deleted and
  // recreated since (e.g. a reseed), this is a stale session, not a real
  // permission error. Send back to sign in fresh instead of crashing.
  if (!isAdmin && regions.length === 0) redirect("/api/auth/force-logout");

  let mentorRows = regions.flatMap((region) =>
    region.units
      .filter((u) => u.mentor)
      .map((u) => ({ mentor: u.mentor!, unitCode: u.code, unitName: u.name, regionName: region.name })),
  );

  if (departmentId !== "ALL") {
    mentorRows = mentorRows.filter((r) => r.mentor.departmentId === departmentId);
  }

  const mentorIds = mentorRows.map((r) => r.mentor.id);

  // 2. Aggregate kehadiran/keaktifan across every session marked so far —
  // same "average over what's recorded, not over every possible session"
  // convention as the maba attendanceAvg in kepala-region/recap.
  const allAttendances =
    mentorIds.length > 0 ? await prisma.mentorAttendance.findMany({ where: { mentorId: { in: mentorIds } } }) : [];
  const byMentor = new Map<string, typeof allAttendances>();
  for (const a of allAttendances) {
    const list = byMentor.get(a.mentorId) ?? [];
    list.push(a);
    byMentor.set(a.mentorId, list);
  }

  const summary = mentorRows.map((row) => {
    const rows = byMentor.get(row.mentor.id) ?? [];
    const hadirCount = rows.filter((a) => a.status === "HADIR").length;
    const attendanceRate = rows.length > 0 ? Math.round((hadirCount / rows.length) * 100) : null;
    const keaktifanScores = rows.filter((a) => a.participationScore !== null).map((a) => a.participationScore!);
    const avgKeaktifan =
      keaktifanScores.length > 0
        ? Number((keaktifanScores.reduce((a, b) => a + b, 0) / keaktifanScores.length).toFixed(1))
        : null;
    return { ...row, sessionsMarked: rows.length, attendanceRate, avgKeaktifan };
  });

  // 3. Input grid — Kepala Region only. Admin gets the recap above, not the
  // ability to grade mentors themselves.
  let sessionSection = null;
  if (!isAdmin) {
    const activities = await getActivitiesOverview();
    const selectedActivity = activities.find((a) => a.code === activity) ?? activities[0];
    const realSessions = selectedActivity ? await getRealSessions(selectedActivity.code) : [];
    const selectedSession = realSessions.find((s) => s.code === session) ?? realSessions[0];

    const people = mentorRows.map((r) => ({ id: r.mentor.id, name: r.mentor.name, nrp: r.mentor.nrp }));

    let initialEntries: Record<string, { status: "HADIR" | "IZIN" | "ALPA"; participationScore: number | null }> = {};
    if (selectedSession && mentorIds.length > 0) {
      const existing = await prisma.mentorAttendance.findMany({
        where: { mentorId: { in: mentorIds }, sessionId: selectedSession.id },
      });
      initialEntries = Object.fromEntries(
        existing.map((row) => [row.mentorId, { status: row.status, participationScore: row.participationScore }]),
      );
    }

    sessionSection = (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Input Presensi &amp; Keaktifan Mentor</CardTitle>
          <CardDescription className="text-xs">
            Pilih kegiatan dan sesi, lalu tandai kehadiran dan keaktifan (1-4) tiap mentor — skala yang sama seperti
            saat mentor mempresensi maba.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action="/kepala-region/mentor-attendance" className="flex flex-col gap-3 sm:flex-row">
            <AutoSubmitSelect
              name="activity"
              defaultValue={selectedActivity?.code ?? ""}
              options={activities.map((a) => ({ value: a.code, label: a.name }))}
            />
            {realSessions.length > 0 ? (
              <AutoSubmitSelect
                name="session"
                defaultValue={selectedSession?.code ?? ""}
                options={realSessions.map((s) => ({ value: s.code, label: s.name }))}
              />
            ) : null}
          </form>

          {!selectedSession ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Kegiatan ini belum memiliki sesi.</p>
          ) : people.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada mentor tertaut di region ini.</p>
          ) : (
            <AttendanceGrid
              key={selectedSession.id}
              people={people}
              draftKey={`mentor-attendance-draft:${selectedSession.id}`}
              initialEntries={initialEntries}
              onSave={saveMentorAttendanceAction.bind(null, selectedSession.id)}
              saveLabel="Simpan Presensi Mentor"
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Presensi & Keaktifan Mentor</h2>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Rekap kehadiran dan keaktifan mentor lintas semua region."
            : "Nilai kehadiran dan keaktifan mentor di region Anda, dengan skala yang sama seperti presensi maba."}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <CardTitle className="text-base">Rekap Kehadiran &amp; Keaktifan Mentor</CardTitle>
            <CardDescription className="text-xs">
              Tingkat Kehadiran dan Rata² Keaktifan dihitung dari sesi yang sudah ditandai saja.
            </CardDescription>
          </div>
          <form action="/kepala-region/mentor-attendance" method="GET" className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isAdmin ? (
              <AutoSubmitSelect name="regionId" defaultValue={regionId} options={regionOptions} />
            ) : null}
            <AutoSubmitSelect name="departmentId" defaultValue={departmentId} options={departmentOptions} />
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {summary.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada mentor untuk ditampilkan.</p>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                    <th className="p-3">Mentor</th>
                    <th className="p-3">Departemen</th>
                    <th className="p-3">Unit</th>
                    {isAdmin ? <th className="p-3">Region</th> : null}
                    <th className="p-3 text-right">Sesi Ditandai</th>
                    <th className="p-3 text-right">Tingkat Kehadiran</th>
                    <th className="p-3 text-right">Rata² Keaktifan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.map((row) => (
                    <tr key={row.mentor.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">
                        {row.mentor.name}
                        <p className="text-[10px] text-muted-foreground font-mono font-normal">{row.mentor.nrp || "-"}</p>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {row.mentor.department ? (
                          <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-mono text-[11px]">
                            {row.mentor.department.code} - {row.mentor.department.name}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {row.unitCode} · {row.unitName}
                      </td>
                      {isAdmin ? <td className="p-3 text-muted-foreground">{row.regionName}</td> : null}
                      <td className="p-3 text-right tabular-nums">{row.sessionsMarked}</td>
                      <td className="p-3 text-right tabular-nums">
                        {row.attendanceRate !== null ? (
                          <span className={row.attendanceRate < 70 ? "text-destructive font-semibold" : ""}>
                            {row.attendanceRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Belum ada</span>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {row.avgKeaktifan !== null ? row.avgKeaktifan : <span className="text-muted-foreground">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {sessionSection}
    </div>
  );
}
