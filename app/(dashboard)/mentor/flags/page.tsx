import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireMentorUnit } from "@/lib/data/mentor";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RaiseFlagForm } from "@/components/scoring/raise-flag-form";

export const metadata: Metadata = { title: "Flag ke Kepala Region" };

export default async function MentorFlagsPage() {
  const user = await getCurrentUser();
  const unit = await requireMentorUnit(user);

  const flags = await prisma.flag.findMany({
    where: { unitId: unit.id },
    include: { student: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Flag ke Kepala Region</h2>
        <p className="text-sm text-muted-foreground">Eskalasi isu yang butuh perhatian di luar alur normal.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flag Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <RaiseFlagForm students={unit.students.map((s) => ({ id: s.id, name: s.name }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Flag</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada flag yang dikirim.</p>
          ) : (
            flags.map((flag) => (
              <div key={flag.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm">{flag.message}</p>
                    {flag.student ? (
                      <p className="mt-1 text-xs text-muted-foreground">Terkait: {flag.student.name}</p>
                    ) : null}
                    {flag.resolutionNote ? (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                        Tanggapan KR: {flag.resolutionNote}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={flag.status === "OPEN" ? "secondary" : "default"} className="shrink-0">
                    {flag.status === "OPEN" ? "Terbuka" : "Selesai"}
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
