import type { Metadata } from "next";
import { AlertCircle, CheckCircle2, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, AttendanceStatus } from "@/app/generated/prisma/enums";
import { AutoSubmitSelect } from "@/components/scoring/auto-submit-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Monitoring Temu FTEIC - Kepala Region" };

export default async function TemuFteicPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const user = await assertRole(Role.KEPALA_REGION, Role.ADMIN);
  if (!user.regionId) {
    throw new Error("Akun Anda belum ditautkan ke wilayah region mana pun.");
  }

  const { sessionId: sessionParam } = await searchParams;

  // 1. Fetch all real sessions under Temu FTEIC (TEMU_1, TEMU_2, TEMU_3)
  const fteicSessions = await prisma.activitySession.findMany({
    where: {
      activity: { code: { in: ["TEMU_1", "TEMU_2", "TEMU_3"] } },
      code: { not: "UMUM" },
    },
    orderBy: [{ activity: { order: "asc" } }, { code: "asc" }],
    include: { activity: true },
  });

  const selectedSession = fteicSessions.find((s) => s.id === sessionParam) || fteicSessions[0];

  if (!selectedSession) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Temu FTEIC</h2>
        <p className="text-sm text-muted-foreground">Belum ada sesi Temu FTEIC yang dibuat di Master Data.</p>
      </div>
    );
  }

  // 2. Fetch all units in this region
  const units = await prisma.unit.findMany({
    where: { regionId: user.regionId },
    orderBy: { code: "asc" },
    include: {
      mentor: { select: { id: true, name: true, nrp: true } },
      students: { select: { id: true } },
    },
  });

  const unitIds = units.map((u) => u.id);

  // 3. Fetch confirmations for the selected session in this region
  const confirmations = await prisma.confirmation.findMany({
    where: {
      sessionId: selectedSession.id,
      unitId: { in: unitIds },
    },
    include: {
      confirmedBy: { select: { name: true } },
    },
  });

  const confirmedUnitIds = new Set(confirmations.map((c) => c.unitId));

  // 4. Fetch live attendance details for this session in this region
  const attendanceRows = await prisma.attendance.findMany({
    where: {
      sessionId: selectedSession.id,
      student: { unitId: { in: unitIds } },
    },
    select: {
      status: true,
      student: { select: { unitId: true } },
    },
  });

  // Calculate live statistics
  const confirmedCount = confirmations.length;
  const totalUnits = units.length;
  const confirmationPct = totalUnits > 0 ? Math.round((confirmedCount / totalUnits) * 100) : 0;
  const threshold = selectedSession.quorumThresholdPct ? Number(selectedSession.quorumThresholdPct) : 75;

  // H-7 Check
  const now = new Date();
  const scheduledDate = selectedSession.scheduledAt ? new Date(selectedSession.scheduledAt) : null;
  const h7Date = scheduledDate ? new Date(scheduledDate.getTime() - 7 * 24 * 60 * 60 * 1000) : null;
  const isPastH7 = h7Date ? now >= h7Date : false;
  const isQuorumFailed = isPastH7 && confirmationPct < threshold;

  // Live Attendance Totals
  const mabaTotal = units.reduce((sum, u) => sum + u.students.length, 0);
  const mabaPresent = attendanceRows.filter((a) => a.status === AttendanceStatus.HADIR).length;
  const mabaPermitted = attendanceRows.filter((a) => a.status === AttendanceStatus.IZIN).length;
  const mabaAbsent = attendanceRows.filter((a) => a.status === AttendanceStatus.ALPA).length;
  const attendanceRegistered = attendanceRows.length;
  const attendancePct = mabaTotal > 0 ? Math.round((mabaPresent / mabaTotal) * 100) : 0;

  // Build matrix per unit
  const matrix = units.map((unit) => {
    const isConfirmed = confirmedUnitIds.has(unit.id);
    const confirmation = confirmations.find((c) => c.unitId === unit.id);
    const unitAttendance = attendanceRows.filter((a) => a.student.unitId === unit.id);
    const presentCount = unitAttendance.filter((a) => a.status === AttendanceStatus.HADIR).length;

    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      mentorName: unit.mentor?.name || "Belum ditautkan",
      isConfirmed,
      confirmedAt: confirmation?.confirmedAt || null,
      confirmedByName: confirmation?.confirmedBy.name || null,
      studentsCount: unit.students.length,
      presentCount,
      attendanceFilled: unitAttendance.length,
    };
  });

  const filterOptions = fteicSessions.map((s) => ({
    value: s.id,
    label: `[${s.activity.code}] ${s.name}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold">Monitoring Temu FTEIC</h2>
          <p className="text-sm text-muted-foreground">Konfirmasi kuorum H-7 dan presensi langsung sesi Temu FTEIC.</p>
        </div>
        <form method="GET" action="/kepala-region/temu-fteic">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Sesi Pertemuan:</span>
            <AutoSubmitSelect
              name="sessionId"
              defaultValue={selectedSession.id}
              options={filterOptions}
            />
          </div>
        </form>
      </div>

      {/* Alarm / Alert Banner */}
      {isQuorumFailed ? (
        <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 rounded-xl">
          <AlertCircle className="size-4" />
          <AlertTitle className="font-semibold">Peringatan: Kuorum Konfirmasi H-7 Belum Tercapai!</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Hari ini sudah melewati batas H-7 pelaksanaan sesi. Rasio konfirmasi saat ini baru mencapai{" "}
            <strong>{confirmationPct}%</strong> dari ambang batas minimum <strong>{threshold}%</strong>. Harap lakukan kalibrasi atau hubungi mentor yang belum mengonfirmasi.
          </AlertDescription>
        </Alert>
      ) : isPastH7 ? (
        <Alert className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 rounded-xl">
          <CheckCircle2 className="size-4" />
          <AlertTitle className="font-semibold">Kuorum Konfirmasi H-7 Aman</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Rasio konfirmasi mentor mencapai <strong>{confirmationPct}%</strong>, melampaui ambang batas minimum{" "}
            <strong>{threshold}%</strong>.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 rounded-xl">
          <Calendar className="size-4" />
          <AlertTitle className="font-semibold">Dalam Tenggat Konfirmasi H-7</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Sesi dijadwalkan pada {selectedSession.scheduledAt ? new Date(selectedSession.scheduledAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"} (H-7 jatuh pada {h7Date ? h7Date.toLocaleDateString("id-ID", { day: "numeric", month: "long" }) : "-"}). Saat ini <strong>{confirmationPct}%</strong> unit sudah mengonfirmasi.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div className="border rounded-xl p-4 bg-card shadow-xs flex flex-col justify-between">
          <span className="text-muted-foreground font-medium">Konfirmasi Mentor</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-bold">{confirmedCount}</span>
            <span className="text-muted-foreground">/ {totalUnits} unit</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Persentase: {confirmationPct}%</span>
        </div>
        <div className="border rounded-xl p-4 bg-card shadow-xs flex flex-col justify-between">
          <span className="text-muted-foreground font-medium">Live Kehadiran Maba</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-bold">{mabaPresent}</span>
            <span className="text-muted-foreground">/ {mabaTotal} maba</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Rasio Hadir: {attendancePct}%</span>
        </div>
        <div className="border rounded-xl p-4 bg-card shadow-xs flex flex-col justify-between">
          <span className="text-muted-foreground font-medium">Kehadiran Terdaftar</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-bold">{attendanceRegistered}</span>
            <span className="text-muted-foreground">/ {mabaTotal} input</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">
            Sisa Belum Diinput: {Math.max(0, mabaTotal - attendanceRegistered)} maba
          </span>
        </div>
        <div className="border rounded-xl p-4 bg-card shadow-xs flex flex-col justify-between">
          <span className="text-muted-foreground font-medium">Izin / Alpa</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-xl font-bold text-amber-500">{mabaPermitted}</span>
            <span className="text-muted-foreground">izin / </span>
            <span className="text-xl font-bold text-destructive">{mabaAbsent}</span>
            <span className="text-muted-foreground">alpa</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Total maba absen: {mabaPermitted + mabaAbsent}</span>
        </div>
      </div>

      {/* Matrix Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail Konfirmasi & Kehadiran Per Unit</CardTitle>
          <CardDescription className="text-xs">Daftar unit, status konfirmasi mentor, dan rekapitulasi kehadiran live.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                  <th className="p-3">Unit</th>
                  <th className="p-3">Mentor</th>
                  <th className="p-3">Konfirmasi H-7</th>
                  <th className="p-3">Tanggal Konfirmasi</th>
                  <th className="p-3">Hadir / Total Maba</th>
                  <th className="p-3">Status Input Presensi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {matrix.map((unit) => (
                  <tr key={unit.id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold">
                      <span className="font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px] mr-1.5 border">
                        {unit.code}
                      </span>
                      {unit.name}
                    </td>
                    <td className="p-3 font-medium">{unit.mentorName}</td>
                    <td className="p-3">
                      {unit.isConfirmed ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                          <CheckCircle2 className="size-3" /> CONFIRMED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          <AlertCircle className="size-3" /> PENDING
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground font-mono">
                      {unit.confirmedAt
                        ? new Date(unit.confirmedAt).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="p-3 font-semibold">
                      {unit.presentCount} <span className="text-muted-foreground font-normal">/ {unit.studentsCount} maba</span>
                    </td>
                    <td className="p-3">
                      {unit.studentsCount === 0 ? (
                        <span className="text-muted-foreground">Tidak ada maba</span>
                      ) : unit.attendanceFilled === unit.studentsCount ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                          SELESAI ({unit.attendanceFilled}/{unit.studentsCount})
                        </span>
                      ) : unit.attendanceFilled > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          PARSIAL ({unit.attendanceFilled}/{unit.studentsCount})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                          BELUM DIINPUT
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
