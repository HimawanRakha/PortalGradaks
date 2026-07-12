import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser, assertCanViewStudent } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { computeScores } from "@/lib/scoring/calculate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBreakdownList } from "@/components/scoring/score-breakdown-list";
import { QuestionnaireCode, LogbookStatus } from "@/app/generated/prisma/enums";

export const metadata: Metadata = { title: "Profil Maba" };

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  await assertCanViewStudent(id, user);

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      unit: { include: { region: true } },
      department: true,
      personalityProfile: true,
      questionnaireStatuses: true,
      logbookEntries: { orderBy: { createdAt: "desc" } },
      attendances: { include: { session: { include: { activity: true } } } },
    },
  });
  if (!student) notFound();

  const computed = await computeScores(id);
  const k1 = student.questionnaireStatuses.find((q) => q.code === QuestionnaireCode.K1);
  const k2 = student.questionnaireStatuses.find((q) => q.code === QuestionnaireCode.K2);
  const logbookComplete = student.logbookEntries.filter((e) => e.status === LogbookStatus.LENGKAP).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{student.name}</h2>
        <p className="text-sm text-muted-foreground">
          {student.nrp} · {student.unit.name} · {student.unit.region.name}
          {student.department ? ` · ${student.department.name}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estimasi Nilai Saat Ini</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Dihitung langsung dari data terkini — bukan nilai final. Nilai resmi baru ada setelah finalisasi PSDM.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Nilai Personal</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {computed.personal.score !== null ? computed.personal.score.toFixed(1) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Nilai Keahlian</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {computed.skill.score !== null ? computed.skill.score.toFixed(1) : "—"}
                </p>
              </div>
            </div>
            <ScoreBreakdownList
              personalGroups={computed.personal.groups}
              skillCategories={computed.skill.categories}
              personalItems={computed.personal.items}
              skillItems={computed.skill.items}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profil Kepribadian (DB1)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Profil deskriptif pendamping — tidak dihitung sebagai komponen berbobot pada nilai akhir.
            </p>
            {student.personalityProfile ? (
              <div className="flex gap-2">
                <Badge variant="secondary">{student.personalityProfile.mbtiType}</Badge>
                <Badge variant="secondary">{student.personalityProfile.temperament}</Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada data (belum diimpor).</p>
            )}
            <div className="flex gap-2 pt-2">
              <Badge variant={k1?.submitted ? "default" : "secondary"}>
                K1 {k1?.submitted ? "terisi" : "belum"}
              </Badge>
              <Badge variant={k2?.submitted ? "default" : "secondary"}>
                K2 {k2?.submitted ? "terisi" : "belum"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Logbook: {logbookComplete}/{student.logbookEntries.length} terverifikasi lengkap
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Logbook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {student.logbookEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada entri logbook.</p>
          ) : (
            student.logbookEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{entry.periodLabel}</p>
                  <p className="truncate text-xs text-muted-foreground">{entry.content}</p>
                </div>
                <Badge
                  variant={
                    entry.status === LogbookStatus.LENGKAP
                      ? "default"
                      : entry.status === LogbookStatus.PERLU_REVISI
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {entry.status.replace(/_/g, " ")}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Kehadiran</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {student.attendances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data kehadiran.</p>
          ) : (
            student.attendances.map((att) => (
              <div key={att.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                <p>{att.session.activity.name} — {att.session.name}</p>
                <div className="flex items-center gap-2">
                  {att.participationScore ? (
                    <span className="text-xs text-muted-foreground">Keaktifan {att.participationScore}</span>
                  ) : null}
                  <Badge variant={att.status === "HADIR" ? "default" : att.status === "ALPA" ? "destructive" : "secondary"}>
                    {att.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
