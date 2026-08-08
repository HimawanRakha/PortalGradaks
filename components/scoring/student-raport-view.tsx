import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBreakdownList } from "@/components/scoring/score-breakdown-list";
import { QuestionnaireCode, LogbookStatus } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import type { ComputedScores } from "@/lib/scoring/calculate";
import { ExternalLink, ImageIcon } from "lucide-react";

/**
 * Parses a string to check if it's a URL (e.g. Google Drive link) and extracts
 * a direct image thumbnail URL if applicable.
 */
function parseDriveImage(urlOrText?: string | null): { isUrl: boolean; imageUrl?: string; originalUrl?: string } {
  if (!urlOrText || typeof urlOrText !== "string") return { isUrl: false };
  const trimmed = urlOrText.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return { isUrl: false };
  }

  // Google Drive File ID extraction
  const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    const fileId = fileIdMatch[1];
    return {
      isUrl: true,
      imageUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      originalUrl: trimmed,
    };
  }

  return { isUrl: true, imageUrl: trimmed, originalUrl: trimmed };
}

/**
 * Shared shape both the mentor's per-student page and the public /cek-raport
 * page fetch — kept in one place so the two call sites can't silently drift
 * (e.g. one forgetting to include a relation the view actually renders).
 */
export const studentRaportInclude = {
  personalityProfile: true,
  questionnaireStatuses: true,
  logbookEntries: { orderBy: { createdAt: "desc" } },
  attendances: { include: { session: { include: { activity: true } } } },
} satisfies Prisma.StudentInclude;

export type StudentForRaportView = Prisma.StudentGetPayload<{ include: typeof studentRaportInclude }>;

/**
 * The report body itself — score cards, personality profile, logbook and
 * attendance history. Deliberately excludes the page header (name/NRP/unit)
 * and any finalized/live status banner, since those differ between the
 * mentor view (always live, no banner) and the public raport lookup
 * (adds a finalized-vs-provisional banner) — callers own that framing.
 */
export function StudentRaportView({ student, computed }: { student: StudentForRaportView; computed: ComputedScores }) {
  const k1 = student.questionnaireStatuses.find((q) => q.code === QuestionnaireCode.K1);
  const k2 = student.questionnaireStatuses.find((q) => q.code === QuestionnaireCode.K2);
  const logbookComplete = student.logbookEntries.filter((e) => e.status === LogbookStatus.LENGKAP).length;

  return (
    <div className="space-y-6">
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
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {student.personalityProfile.mbtiType ? (
                    <Badge variant="secondary" className="font-semibold">
                      MBTI: {student.personalityProfile.mbtiType}
                    </Badge>
                  ) : null}
                  {student.personalityProfile.temperament &&
                  !parseDriveImage(student.personalityProfile.temperament).isUrl ? (
                    <Badge variant="secondary">{student.personalityProfile.temperament}</Badge>
                  ) : null}
                </div>

                {student.personalityProfile.temperament && (() => {
                  const driveInfo = parseDriveImage(student.personalityProfile.temperament);
                  if (!driveInfo.isUrl) return null;
                  return (
                    <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <ImageIcon className="size-3.5" />
                          Bukti Tes Kepribadian
                        </span>
                        {driveInfo.originalUrl ? (
                          <a
                            href={driveInfo.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline text-xs"
                          >
                            Buka Drive <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </div>
                      <a
                        href={driveInfo.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-md border bg-background"
                      >
                        <img
                          src={driveInfo.imageUrl}
                          alt="Bukti Tes Kepribadian Maba"
                          className="max-h-56 w-full object-contain bg-neutral-950/5 dark:bg-neutral-950/40 p-1 hover:opacity-90 transition-opacity"
                        />
                      </a>
                    </div>
                  );
                })()}
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
