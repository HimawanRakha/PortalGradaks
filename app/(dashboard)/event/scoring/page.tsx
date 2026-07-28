import type { Metadata } from "next";
import { assertCanScoreInclenationEvent } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { RegionEventCard } from "@/components/event/region-event-card";

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
          Isi nilai Terkompak per region dan tandai unit pemenang Winner Throne Battle. Kategori Teraktif/Terdisiplin/
          Pelanggaran diisi masing-masing mentor di halaman Scoring unit mereka.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {regions.map((region) => (
          <RegionEventCard
            key={region.id}
            region={{ id: region.id, code: region.code, name: region.name }}
            units={region.units}
            terkompakParams={terkompakParams}
            throneParam={throneParam}
            initialTerkompakValues={regionScoreMap.get(region.id) ?? {}}
            initialThroneValues={Object.fromEntries(region.units.map((u) => [u.id, throneValueByUnit.get(u.id) ?? null]))}
          />
        ))}
      </div>
    </div>
  );
}
