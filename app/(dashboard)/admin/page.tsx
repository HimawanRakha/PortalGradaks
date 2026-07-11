import type { Metadata } from "next";
import Link from "next/link";
import { Users, BookOpenCheck, Flag, CheckCircle2, ShieldAlert, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, LogbookStatus, FlagStatus } from "@/app/generated/prisma/enums";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata: Metadata = { title: "Monitoring Nasional - Admin" };

export default async function AdminHomePage() {
  await assertRole(Role.ADMIN);

  // 1. Fetch national overview stats
  const [
    totalMaba,
    missingPersonality,
    missingK1,
    missingK2,
    unverifiedLogbooks,
    openFlags,
    regions,
  ] = await Promise.all([
    prisma.student.count({ where: { active: true } }),
    prisma.student.count({ where: { active: true, personalityProfile: null } }),
    prisma.student.count({
      where: {
        active: true,
        OR: [
          { NOT: { questionnaireStatuses: { some: { code: "K1" } } } },
          { questionnaireStatuses: { some: { code: "K1", submitted: false } } },
        ],
      },
    }),
    prisma.student.count({
      where: {
        active: true,
        OR: [
          { NOT: { questionnaireStatuses: { some: { code: "K2" } } } },
          { questionnaireStatuses: { some: { code: "K2", submitted: false } } },
        ],
      },
    }),
    prisma.logbookEntry.count({ where: { status: LogbookStatus.BELUM_DIVERIFIKASI } }),
    prisma.flag.count({ where: { status: FlagStatus.OPEN } }),
    prisma.region.findMany({
      orderBy: { code: "asc" },
      include: {
        units: {
          select: {
            id: true,
            students: { select: { id: true } },
          },
        },
      },
    }),
  ]);

  // 2. Fetch list of maba with incomplete data for follow-up (take 5)
  const followUpMaba = await prisma.student.findMany({
    where: {
      active: true,
      OR: [
        { personalityProfile: null },
        { questionnaireStatuses: { some: { submitted: false } } },
        { logbookEntries: { some: { status: LogbookStatus.BELUM_DIVERIFIKASI } } },
      ],
    },
    select: {
      id: true,
      name: true,
      nrp: true,
      unit: { select: { code: true, name: true, region: { select: { name: true } } } },
      personalityProfile: { select: { id: true } },
      logbookEntries: { where: { status: LogbookStatus.BELUM_DIVERIFIKASI }, select: { id: true } },
      questionnaireStatuses: { select: { code: true, submitted: true } },
    },
    take: 5,
  });

  // Calculate region stats matrix
  const regionMatrix = await Promise.all(
    regions.map(async (reg) => {
      const regUnitIds = reg.units.map((u) => u.id);
      const regMabaCount = reg.units.reduce((sum, u) => sum + u.students.length, 0);

      // Query database progress for this region
      let scoresDone = 0;
      let scoresTotal = 0;

      if (regUnitIds.length > 0 && regMabaCount > 0) {
        const activeParams = await prisma.parameter.count({ where: { active: true } });
        scoresTotal = activeParams * regMabaCount;

        if (scoresTotal > 0) {
          scoresDone = await prisma.score.count({
            where: {
              student: { unitId: { in: regUnitIds } },
              parameter: { active: true },
              value: { not: null },
            },
          });
        }
      }

      const progress = scoresTotal > 0 ? Math.round((scoresDone / scoresTotal) * 100) : 0;

      const [regPendingLogbooks, regOpenFlags] = await Promise.all([
        prisma.logbookEntry.count({
          where: { student: { unitId: { in: regUnitIds } }, status: LogbookStatus.BELUM_DIVERIFIKASI },
        }),
        prisma.flag.count({
          where: { unitId: { in: regUnitIds }, status: FlagStatus.OPEN },
        }),
      ]);

      return {
        id: reg.id,
        code: reg.code,
        name: reg.name,
        unitsCount: reg.units.length,
        mabaCount: regMabaCount,
        progress,
        pendingLogbooks: regPendingLogbooks,
        openFlags: regOpenFlags,
      };
    }),
  );

  return (
    <div className="space-y-6 text-xs">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dashboard Monitoring Nasional</h2>
        <p className="text-sm text-muted-foreground">Pusat pemantauan evaluasi dan kelengkapan data mahasiswa baru FTEIC 2026.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Mahasiswa Baru" value={totalMaba} icon={Users} />
        <StatCard
          label="Logbook Menunggu Verifikasi"
          value={unverifiedLogbooks}
          icon={BookOpenCheck}
          tone={unverifiedLogbooks > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Eskalasi Isu Terbuka"
          value={openFlags}
          icon={Flag}
          tone={openFlags > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Profil MBTI Belum Impor"
          value={missingPersonality}
          icon={ShieldAlert}
          tone={missingPersonality > 0 ? "warning" : "success"}
        />
      </div>

      {/* Detail Incompleteness Checklist */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Statistics Checklist */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ShieldAlert className="size-4.5 text-primary" />
              Kelengkapan Berkas Maba
            </CardTitle>
            <CardDescription className="text-[10px]">Statistik berkas eksternal yang belum masuk database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground font-medium">Tes Kepribadian (MBTI)</span>
              <span className={`px-2 py-0.5 rounded-full font-mono font-bold ${
                missingPersonality > 0 ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-green-500/10 text-green-500 border border-green-500/20"
              }`}>
                {missingPersonality} maba pending
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground font-medium">Kuesioner Baseline (K1)</span>
              <span className={`px-2 py-0.5 rounded-full font-mono font-bold ${
                missingK1 > 0 ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-green-500/10 text-green-500 border border-green-500/20"
              }`}>
                {missingK1} maba pending
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground font-medium">Kuesioner Refleksi (K2)</span>
              <span className={`px-2 py-0.5 rounded-full font-mono font-bold ${
                missingK2 > 0 ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-green-500/10 text-green-500 border border-green-500/20"
              }`}>
                {missingK2} maba pending
              </span>
            </div>
            <Link href="/admin/imports" className="flex items-center justify-between text-primary font-semibold hover:underline pt-2 text-[11px]">
              Buka pusat impor data untuk mengunggah CSV GForm
              <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Follow-up students */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <BookOpenCheck className="size-4.5 text-primary" />
              Tindak Lanjut Cepat (Maba Pending Berkas)
            </CardTitle>
            <CardDescription className="text-[10px]">Daftar maba dengan kekurangan data profil/logbook terberat.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {followUpMaba.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Semua data berkas maba lengkap!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                      <th className="p-3">Maba / NRP</th>
                      <th className="p-3">Unit / Region</th>
                      <th className="p-3">Kekurangan Berkas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {followUpMaba.map((m) => {
                      const hasK1 = m.questionnaireStatuses.some((q) => q.code === "K1" && q.submitted);
                      const hasK2 = m.questionnaireStatuses.some((q) => q.code === "K2" && q.submitted);
                      const hasMBTI = !!m.personalityProfile;
                      const pendingLogCount = m.logbookEntries.length;

                      const issues = [];
                      if (!hasMBTI) issues.push("Profil MBTI");
                      if (!hasK1) issues.push("K1 (Baseline)");
                      if (!hasK2) issues.push("K2 (Refleksi)");
                      if (pendingLogCount > 0) issues.push(`${pendingLogCount} Logbook Pending`);

                      return (
                        <tr key={m.id} className="hover:bg-muted/30">
                          <td className="p-3">
                            <p className="font-semibold text-foreground">{m.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{m.nrp}</p>
                          </td>
                          <td className="p-3 text-muted-foreground font-medium">
                            {m.unit.code} ({m.unit.name}) · {m.unit.region.name}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {issues.map((iss, idx) => (
                                <span key={idx} className="bg-destructive/10 text-destructive border border-destructive/20 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  {iss}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Regional Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Tabel Kelengkapan Input Lintas Region</CardTitle>
          <CardDescription className="text-xs">
            Rasio pengisian nilai dan penanganan eskalasi per region secara real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                  <th className="p-3">Region</th>
                  <th className="p-3">Jumlah Unit</th>
                  <th className="p-3">Total Maba</th>
                  <th className="p-3">Rata-rata Pengisian Nilai</th>
                  <th className="p-3">Logbook Belum Verifikasi</th>
                  <th className="p-3">Eskalasi Isu</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {regionMatrix.map((reg) => (
                  <tr key={reg.id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold text-foreground">
                      <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] mr-1.5 border border-primary/20">
                        {reg.code}
                      </span>
                      {reg.name}
                    </td>
                    <td className="p-3 text-muted-foreground font-mono">{reg.unitsCount} unit</td>
                    <td className="p-3 text-muted-foreground font-mono">{reg.mabaCount} maba</td>
                    <td className="p-3 w-56">
                      {reg.mabaCount === 0 ? (
                        <span className="text-muted-foreground font-normal">Tidak ada maba</span>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[9px]">
                            <span>Progress Pengisian</span>
                            <span>{reg.progress}%</span>
                          </div>
                          <Progress value={reg.progress} className="h-1.5" />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {reg.pendingLogbooks > 0 ? (
                        <span className="text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-[10px]">
                          {reg.pendingLogbooks} pending
                        </span>
                      ) : (
                        <span className="text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 text-[10px]">
                          Lengkap
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {reg.openFlags > 0 ? (
                        <span className="text-destructive font-bold bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20 text-[10px]">
                          {reg.openFlags} eskalasi
                        </span>
                      ) : (
                        <span className="text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 text-[10px]">
                          Clean
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
