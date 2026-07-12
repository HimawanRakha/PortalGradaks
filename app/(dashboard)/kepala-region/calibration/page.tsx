import type { Metadata } from "next";
import { CheckCircle2, AlertTriangle, AlertCircle, TrendingUp, Info } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, ParameterType } from "@/app/generated/prisma/enums";
import { AutoSubmitSelect } from "@/components/scoring/auto-submit-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Kalibrasi Mentor - Kepala Region" };

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string }>;
}) {
  const user = await assertRole(Role.KEPALA_REGION, Role.ADMIN);
  if (!user.regionId) {
    throw new Error("Akun Anda belum ditautkan ke wilayah region mana pun.");
  }

  const { activity: activityParam } = await searchParams;

  // 1. Fetch calibration threshold setting (default 0.6)
  const thresholdSetting = await prisma.setting.findUnique({
    where: { key: "calibration.deviationThreshold" },
  });
  const threshold = thresholdSetting ? Number(thresholdSetting.value) : 0.6;

  // 2. Fetch activities that have behavior parameters (Type B)
  const availableActivities = await prisma.activity.findMany({
    where: {
      active: true,
      materials: {
        some: {
          active: true,
          parameters: {
            some: { type: ParameterType.B, active: true },
          },
        },
      },
    },
    orderBy: { order: "asc" },
  });

  const selectedActivity = availableActivities.find((act) => act.code === activityParam) || availableActivities[0];

  if (!selectedActivity) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Kalibrasi Mentor</h2>
        <p className="text-sm text-muted-foreground">Belum ada parameter perilaku (Tipe B) yang dibuat di Master Data.</p>
      </div>
    );
  }

  // 3. Fetch all behavior parameters under the selected activity
  const parameters = await prisma.parameter.findMany({
    where: {
      material: { activityId: selectedActivity.id },
      type: ParameterType.B,
      active: true,
    },
    select: { id: true },
  });

  const parameterIds = parameters.map((p) => p.id);

  // 4. Fetch units in this region
  const units = await prisma.unit.findMany({
    where: { regionId: user.regionId },
    orderBy: { code: "asc" },
    include: {
      mentor: { select: { id: true, name: true, nrp: true } },
      students: { select: { id: true } },
    },
  });

  const unitIds = units.map((u) => u.id);

  // 5. Query all behavior scores entered for students in this region for the selected activity
  const scores = await prisma.score.findMany({
    where: {
      parameterId: { in: parameterIds },
      student: { unitId: { in: unitIds } },
      value: { not: null },
    },
    select: {
      value: true,
      student: { select: { unitId: true } },
    },
  });

  // Calculate Region Average
  const totalScoresCount = scores.length;
  const scoresSum = scores.reduce((sum, s) => sum + (s.value || 0), 0);
  const regionAverage = totalScoresCount > 0 ? Number((scoresSum / totalScoresCount).toFixed(3)) : null;

  // Calculate Average per Unit/Mentor
  const unitCalibrations = units.map((unit) => {
    const unitScores = scores.filter((s) => s.student.unitId === unit.id);
    const count = unitScores.length;
    const sum = unitScores.reduce((acc, s) => acc + (s.value || 0), 0);
    const average = count > 0 ? Number((sum / count).toFixed(3)) : null;

    let deviation = null;
    let isOutlier = false;
    let direction: "high" | "low" | "neutral" = "neutral";

    if (average !== null && regionAverage !== null) {
      deviation = Number(Math.abs(average - regionAverage).toFixed(3));
      isOutlier = deviation > threshold;
      direction = average > regionAverage ? "high" : "low";
    }

    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      mentorName: unit.mentor?.name || "Belum ditautkan",
      scoresCount: count,
      average,
      deviation,
      isOutlier,
      direction,
    };
  });

  const outliersCount = unitCalibrations.filter((u) => u.isOutlier).length;

  const filterOptions = availableActivities.map((act) => ({
    value: act.code,
    label: act.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold">Kalibrasi Penilaian Mentor</h2>
          <p className="text-sm text-muted-foreground">
            Mendeteksi anomali penilaian perilaku (skor 1-4) mentor yang melampaui batas deviasi.
          </p>
        </div>
        <form method="GET" action="/kepala-region/calibration">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Kegiatan:</span>
            <AutoSubmitSelect
              name="activity"
              defaultValue={selectedActivity.code}
              options={filterOptions}
            />
          </div>
        </form>
      </div>

      {/* Overview stats alert */}
      {outliersCount > 0 ? (
        <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 rounded-xl">
          <AlertTriangle className="size-4" />
          <AlertTitle className="font-semibold">Terdeteksi Anomali Penilaian!</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Ada <strong>{outliersCount}</strong> mentor yang memiliki deviasi rata-rata skor di atas{" "}
            <strong>{threshold}</strong> dari rata-rata region (<strong>{regionAverage}</strong>). Mentor ini dinilai terlalu ketat atau terlalu longgar dalam memberikan penilaian perilaku.
          </AlertDescription>
        </Alert>
      ) : regionAverage !== null ? (
        <Alert className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 rounded-xl">
          <CheckCircle2 className="size-4" />
          <AlertTitle className="font-semibold">Penilaian Terkalibrasi Dengan Baik</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Seluruh mentor memberikan penilaian yang konsisten. Tidak ada deviasi penilaian yang melebihi ambang batas{" "}
            <strong>{threshold}</strong> dari rata-rata regional <strong>{regionAverage}</strong>.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 rounded-xl">
          <Info className="size-4" />
          <AlertTitle className="font-semibold">Menunggu Input Nilai</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Belum ada nilai perilaku yang dimasukkan oleh mentor untuk kegiatan <strong>{selectedActivity.name}</strong> di wilayah region ini.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary statistics cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px]">Rata-rata Regional</CardDescription>
            <CardTitle className="text-xl font-bold flex items-center gap-1.5 mt-1">
              <TrendingUp className="size-4.5 text-primary" />
              {regionAverage !== null ? regionAverage : "-"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[10px] text-muted-foreground">
            Berdasarkan total {totalScoresCount} nilai perilaku terinput di region.
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px]">Penyimpangan Ekstrem</CardDescription>
            <CardTitle className="text-xl font-bold text-destructive mt-1">
              {outliersCount} <span className="text-xs text-muted-foreground font-normal">mentor</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[10px] text-muted-foreground">
            Mentor dengan deviasi rata-rata skor &gt; {threshold} poin.
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px]">Ambang Batas Kalibrasi</CardDescription>
            <CardTitle className="text-xl font-bold text-primary mt-1">
              ± {threshold}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[10px] text-muted-foreground">
            Nilai deviasi maksimum yang diizinkan sebelum ditandai anomali.
          </CardContent>
        </Card>
      </div>

      {/* Calibration List Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Matriks Deviasi Skor Mentor</CardTitle>
          <CardDescription className="text-xs">
            Perbandingan nilai rata-rata perilaku tiap mentor terhadap standar region.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                  <th className="p-3">Unit</th>
                  <th className="p-3">Mentor</th>
                  <th className="p-3">Jumlah Input Nilai</th>
                  <th className="p-3">Rata-rata Skor Mentor</th>
                  <th className="p-3">Deviasi Region ({regionAverage})</th>
                  <th className="p-3">Status Kalibrasi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {unitCalibrations.map((cal) => (
                  <tr key={cal.id} className={`hover:bg-muted/30 ${cal.isOutlier ? "bg-red-500/5 hover:bg-red-500/10" : ""}`}>
                    <td className="p-3 font-semibold">
                      <span className="font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px] mr-1.5 border">
                        {cal.code}
                      </span>
                      {cal.name}
                    </td>
                    <td className="p-3 font-medium">{cal.mentorName}</td>
                    <td className="p-3 font-mono">{cal.scoresCount} input</td>
                    <td className="p-3 font-mono font-bold">
                      {cal.average !== null ? (
                        <span className={cal.isOutlier ? "text-destructive" : ""}>{cal.average}</span>
                      ) : (
                        <span className="text-muted-foreground font-normal font-sans">Belum ada input</span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-semibold">
                      {cal.deviation !== null ? (
                        <span className={cal.isOutlier ? "text-destructive" : "text-muted-foreground"}>
                          {cal.average! > regionAverage! ? "+" : "-"}
                          {cal.deviation}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3">
                      {cal.average === null ? (
                        "-"
                      ) : cal.isOutlier ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          cal.direction === "high" 
                            ? "text-red-500 bg-red-500/10 border-red-500/20" 
                            : "text-amber-500 bg-amber-500/10 border-amber-500/20"
                        }`}>
                          <AlertCircle className="size-3" />
                          {cal.direction === "high" ? "OVER-RATING (Longgar)" : "UNDER-RATING (Ketat)"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                          <CheckCircle2 className="size-3" /> TERKALIBRASI
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
