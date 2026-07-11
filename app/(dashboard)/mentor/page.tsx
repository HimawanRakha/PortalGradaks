import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, Users, BookOpenCheck, Flag } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireMentorUnit, getUnitProgress } from "@/lib/data/mentor";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { StatCard } from "@/components/dashboard/stat-card";
import { LogbookStatus, FlagStatus } from "@/app/generated/prisma/enums";

export const metadata: Metadata = { title: "Beranda Mentor" };

export default async function MentorHomePage() {
  const user = await getCurrentUser();
  const unit = await requireMentorUnit(user);
  const progress = await getUnitProgress(unit.id);

  const studentIds = unit.students.map((s) => s.id);
  const [pendingLogbook, openFlags] = await Promise.all([
    prisma.logbookEntry.count({ where: { studentId: { in: studentIds }, status: LogbookStatus.BELUM_DIVERIFIKASI } }),
    prisma.flag.count({ where: { unitId: unit.id, status: FlagStatus.OPEN } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{unit.name}</h2>
        <p className="text-sm text-muted-foreground">{unit.region.name} · {unit.students.length} maba</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Maba di unit" value={unit.students.length} icon={Users} />
        <StatCard
          label="Logbook belum diverifikasi"
          value={pendingLogbook}
          icon={BookOpenCheck}
          tone={pendingLogbook > 0 ? "warning" : "success"}
        />
        <StatCard label="Flag terbuka" value={openFlags} icon={Flag} tone={openFlags > 0 ? "danger" : "default"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progres per Kegiatan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {progress.map(({ activity, done, total }) => {
              const pct = total > 0 ? (done / total) * 100 : 0;
              return (
                <Link
                  key={activity.id}
                  href={`/mentor/scoring?activity=${activity.code}`}
                  className="flex flex-col items-center gap-2 rounded-lg p-3 text-center transition-colors hover:bg-muted"
                >
                  <ProgressRing value={pct} />
                  <div>
                    <p className="text-xs font-medium leading-tight">{activity.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {total > 0 ? `${done}/${total} terisi` : "Tidak ada parameter"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          render={<Link href="/mentor/scoring" />}
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
        >
          <ClipboardList className="size-4.5" />
          <span className="text-left">
            <span className="block text-sm font-medium">Isi Scoring</span>
            <span className="block text-xs font-normal text-muted-foreground">Parameter perilaku & penugasan</span>
          </span>
        </Button>
        <Button
          render={<Link href="/mentor/logbook" />}
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
        >
          <BookOpenCheck className="size-4.5" />
          <span className="text-left">
            <span className="block text-sm font-medium">Verifikasi Logbook</span>
            <span className="block text-xs font-normal text-muted-foreground">{pendingLogbook} menunggu</span>
          </span>
        </Button>
        <Button
          render={<Link href="/mentor/students" />}
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
        >
          <Users className="size-4.5" />
          <span className="text-left">
            <span className="block text-sm font-medium">Profil Maba</span>
            <span className="block text-xs font-normal text-muted-foreground">Kepribadian, K1/K2, riwayat</span>
          </span>
        </Button>
      </div>
    </div>
  );
}
