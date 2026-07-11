import type { Metadata } from "next";
import { assertRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";
import { Finalizer } from "@/components/admin/finalizer";

export const metadata: Metadata = { title: "Finalisasi & Snapshot Raport - Admin" };

export default async function FinalizationPage() {
  await assertRole(Role.ADMIN);

  const [totalMaba, finalizedCount, rawSnapshots] = await Promise.all([
    prisma.student.count({ where: { active: true } }),
    prisma.raportSnapshot.count(),
    prisma.raportSnapshot.findMany({
      include: {
        student: { select: { name: true, nrp: true } },
        finalizedBy: { select: { name: true } },
      },
      orderBy: { student: { name: "asc" } },
      take: 100,
    }),
  ]);

  const snapshots = rawSnapshots.map((s) => ({
    id: s.id,
    studentName: s.student.name,
    studentNrp: s.student.nrp,
    personalScore: Number(s.personalScore),
    skillScore: Number(s.skillScore),
    recommendation: s.recommendation,
    finalizedAt: s.finalizedAt,
    finalizedByName: s.finalizedBy.name,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Finalisasi & Pembekuan Raport</h2>
        <p className="text-sm text-muted-foreground">
          Kalkulasi final Nilai Personal, Nilai Keahlian, dan beku-kan status kelulusan maba.
        </p>
      </div>

      <Finalizer
        totalMaba={totalMaba}
        finalizedCount={finalizedCount}
        snapshots={snapshots}
      />
    </div>
  );
}
