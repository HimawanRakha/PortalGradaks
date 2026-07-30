import type { Metadata } from "next";
import { assertCanScoreInclenationEvent } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { RegionScoringTabs } from "@/components/event/region-scoring-tabs";

export const metadata: Metadata = { title: "Penilaian Event - Terkompak & Throne Battle" };

export default async function EventScoringPage() {
  await assertCanScoreInclenationEvent();

  const [regions, terkompakParams, throneParam, regionScores, throneScores] = await Promise.all([
    prisma.region.findMany({
      orderBy: { code: "asc" },
      include: { units: { orderBy: { code: "asc" }, select: { id: true, code: true, name: true } } },
    }),
    prisma.parameter.findMany({
      where: { material: { code: "TERKOMPAK" }, active: true },
      orderBy: { order: "asc" },
      select: { id: true, subCode: true, name: true },
    }),
    prisma.parameter.findFirst({
      where: { material: { code: "THRONE_BATTLE" }, active: true },
      select: { id: true, name: true },
    }),
    prisma.regionEventScore.findMany({ select: { regionId: true, parameterId: true, value: true } }),
    prisma.unitEventScore.findMany({
      where: { parameter: { material: { code: "THRONE_BATTLE" } } },
      select: { unitId: true, value: true },
    }),
  ]);

  if (terkompakParams.length === 0 || !throneParam) {
    return (
      <p className="text-sm text-muted-foreground">
        Parameter Terkompak/Throne Battle belum dikonfigurasi di Master Data &gt; Parameter.
      </p>
    );
  }

  const regionScoreMap = new Map<string, Record<string, number | null>>();
  for (const s of regionScores) {
    if (!regionScoreMap.has(s.regionId)) regionScoreMap.set(s.regionId, {});
    regionScoreMap.get(s.regionId)![s.parameterId] = s.value;
  }
  const throneValueByUnit = new Map(throneScores.map((s) => [s.unitId, s.value]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Penilaian Event Inclenation</h2>
        <p className="text-sm text-muted-foreground">
          Pilih region melalui tab dropdown untuk mengisi nilai Terkompak dan pemenang Winner Throne Battle. Kategori
          Teraktif/Terdisiplin/Pelanggaran diisi masing-masing mentor di halaman Scoring unit mereka.
        </p>
      </div>

      <RegionScoringTabs
        regions={regions}
        terkompakParams={terkompakParams}
        throneParam={throneParam}
        regionScoreMap={regionScoreMap}
        throneValueByUnit={throneValueByUnit}
      />
    </div>
  );
}
