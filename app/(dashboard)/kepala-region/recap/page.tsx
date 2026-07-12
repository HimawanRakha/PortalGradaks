import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = { title: "Rekap Sub-nilai Region - Kepala Region" };

export default async function RegionRecapPage() {
  const user = await assertRole(Role.KEPALA_REGION, Role.ADMIN);
  if (!user.regionId) {
    throw new Error("Akun Anda belum ditautkan ke wilayah region mana pun.");
  }

  // 1. Fetch region info & units
  const [region, materials] = await Promise.all([
    prisma.region.findUnique({
      where: { id: user.regionId },
      include: {
        units: {
          orderBy: { code: "asc" },
          include: {
            mentor: { select: { name: true } },
            students: { select: { id: true } },
          },
        },
      },
    }),
    prisma.material.findMany({
      where: { active: true, activity: { active: true } },
      orderBy: [{ activity: { order: "asc" } }, { order: "asc" }],
      include: {
        parameters: { where: { active: true } },
      },
    }),
  ]);
  // Session's regionId is frozen at sign-in — if the region was deleted and
  // recreated since (e.g. a reseed), this is a stale session, not a real
  // permission error. Send back to sign in fresh instead of crashing.
  if (!region) redirect("/login");

  // Keep only materials that have active parameters
  const activeMaterials = materials.filter((m) => m.parameters.length > 0);

  // 2. Compute average scores per unit per material
  const recapData = await Promise.all(
    region.units.map(async (unit) => {
      const studentIds = unit.students.map((s) => s.id);

      if (studentIds.length === 0) {
        return {
          id: unit.id,
          code: unit.code,
          name: unit.name,
          mentorName: unit.mentor?.name || "Belum ditautkan",
          studentsCount: 0,
          attendanceAvg: null,
          materialAverages: activeMaterials.map((m) => ({ id: m.id, code: m.code, average: null })),
        };
      }

      // Fetch all scores for the students in this unit
      const scores = await prisma.score.findMany({
        where: {
          studentId: { in: studentIds },
          parameter: { active: true },
          value: { not: null },
        },
        include: { parameter: true },
      });

      // Fetch group scores for these students
      const groupScores = await prisma.groupScore.findMany({
        where: {
          group: { members: { some: { studentId: { in: studentIds } } } },
        },
        include: { parameter: true },
      });

      // Fetch attendance entries
      const attendance = await prisma.attendance.findMany({
        where: { studentId: { in: studentIds } },
      });

      // Calculate attendance average (status: ALPA = 0, IZIN = 50% * participationScore, HADIR = participationScore)
      let attendanceAvg = null;
      if (attendance.length > 0) {
        const sum = attendance.reduce((acc, entry) => {
          const base = entry.participationScore ?? 0;
          const val = entry.status === "ALPA" ? 0 : entry.status === "IZIN" ? base * 0.5 : base;
          return acc + (val / 4) * 100; // Normalize 0-4 scale to 0-100
        }, 0);
        attendanceAvg = Math.round(sum / attendance.length);
      }

      // Calculate average per material
      const materialAverages = activeMaterials.map((material) => {
        const paramIds = new Set(material.parameters.map((p) => p.id));
        
        // Find individual scores under this material
        const matchingScores = scores.filter((s) => paramIds.has(s.parameterId));
        // Find group scores under this material
        const matchingGroupScores = groupScores.filter((gs) => paramIds.has(gs.parameterId));

        const allScoresNormalized: number[] = [];

        for (const s of matchingScores) {
          if (s.value !== null) {
            allScoresNormalized.push((s.value / s.parameter.maxValue) * 100);
          }
        }

        for (const gs of matchingGroupScores) {
          if (gs.value !== null) {
            allScoresNormalized.push((gs.value / gs.parameter.maxValue) * 100);
          }
        }

        const average = allScoresNormalized.length > 0
          ? Math.round(allScoresNormalized.reduce((a, b) => a + b, 0) / allScoresNormalized.length)
          : null;

        return {
          id: material.id,
          code: material.code,
          average,
        };
      });

      return {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        mentorName: unit.mentor?.name || "Belum ditautkan",
        studentsCount: unit.students.length,
        attendanceAvg,
        materialAverages,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold">Rekapitulasi Nilai Region</h2>
          <p className="text-sm text-muted-foreground">
            Matriks ringkasan rata-rata sub-nilai dan presensi per unit mentoring (skala 0-100).
          </p>
        </div>
      </div>

      {/* Recap Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            <BarChart3 className="size-4.5 text-primary" />
            Matriks Rata-rata Nilai Unit
          </CardTitle>
          <CardDescription className="text-xs">
            Skor di bawah ini merupakan rata-rata ter-normalisasi (skala 0 - 100) dari seluruh maba di setiap unit.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                  <th className="p-3 sticky left-0 bg-background z-10 border-r">Unit / Mentor</th>
                  <th className="p-3 text-center">Presensi</th>
                  {activeMaterials.map((m) => (
                    <th key={m.id} className="p-3 text-center font-mono">
                      {m.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {recapData.map((unit) => (
                  <tr key={unit.id} className="hover:bg-muted/30">
                    <td className="p-3 sticky left-0 bg-background z-10 border-r">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <span className="font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded text-[9px] border">
                            {unit.code}
                          </span>
                          {unit.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium mt-0.5">{unit.mentorName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-semibold">
                      {unit.studentsCount === 0 ? (
                        <span className="text-muted-foreground font-normal">-</span>
                      ) : unit.attendanceAvg !== null ? (
                        <span className={unit.attendanceAvg < 70 ? "text-destructive" : "text-green-600 dark:text-green-400"}>
                          {unit.attendanceAvg}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">Belum ada</span>
                      )}
                    </td>
                    {unit.materialAverages.map((m, idx) => (
                      <td key={idx} className="p-3 text-center font-mono font-semibold">
                        {unit.studentsCount === 0 ? (
                          <span className="text-muted-foreground font-normal">-</span>
                        ) : m.average !== null ? (
                          <span className={m.average < 60 ? "text-amber-500" : ""}>{m.average}</span>
                        ) : (
                          <span className="text-muted-foreground font-normal">-</span>
                        )}
                      </td>
                    ))}
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
