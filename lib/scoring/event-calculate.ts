import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Calculation engine for the Inclenation EVENT competition scoreboard
 * (Terbaik / Terdisiplin / Terkompak) — completely separate from
 * lib/scoring/calculate.ts's Nilai Personal/Keahlian engine. Scores whole
 * Units and Regions, never individual students, and never reads
 * Parameter.personalWeight/skillWeight.
 *
 * Buckets are resolved by MATERIAL CODE membership (sum every parameter a
 * unit/region has under that material), not by hardcoded subCode — so a new
 * Terdisiplin criterion or Pelanggaran type added later via Master Data
 * (Admin > Master Data > Parameter, same Material) is picked up with zero
 * code changes. The only subCodes this file hardcodes are the two
 * Pelanggaran exceptions the source spreadsheet itself calls out (see
 * PELANGGARAN_TELAT_SUBCODE / PELANGGARAN_EXCLUDED_FROM_TOTAL below).
 *
 * Formulas (confirmed with the user against "PENILAIAN INCLE 2026.xlsx"):
 *   RegionTerkompakScore = raw === criteriaCount ? raw*2 : raw
 *   UnitTerbaikScore = Teraktif*2 + TerdisiplinRaw + (35 if Throne winner)
 *                      - PelanggaranTotal + RegionTerkompakScore(own region)
 *                      + MaterialAvgContribution
 *   UnitTerdisiplinScore = TerdisiplinRaw - PelanggaranTotal
 * PelanggaranTotal doubles "TELAT" past 5 and excludes "LAINNYA" entirely —
 * replicating the source file's own column-N formula exactly.
 */

const MATERIAL = {
  TERAKTIF: "TERAKTIF",
  TERDISIPLIN: "TERDISIPLIN",
  PELANGGARAN: "PELANGGARAN",
  THRONE_BATTLE: "THRONE_BATTLE",
  TERKOMPAK: "TERKOMPAK",
} as const;

/** The 5 curriculum materials mentors score per-student during Inclenation (1-4 scale each). */
const CURRICULUM_MATERIAL_CODES = ["KWYA", "BMB", "WAWASAN_TEKNOLOGI", "WAWASAN_FTEIC", "MARS_ELECTICS"];

/** Doubled past 5 late people, exactly like the source file's `IF(Telat>5, Telat*2, Telat*1)`. */
const PELANGGARAN_TELAT_SUBCODE = "TELAT";
/** Committee-adjudicated, arbitrary amount — the source file's own formula excludes it from the automatic total (still stored & shown). */
const PELANGGARAN_EXCLUDED_FROM_TOTAL = new Set(["LAINNYA"]);

const THRONE_BATTLE_BONUS = 35;
/**
 * Raw 1-4 average, NOT normalized to 0-100 — kept on the same "stack raw
 * points" style as the rest of this formula (Throne Battle is +35, one
 * Terdisiplin criterion is up to 5, etc.). This is a deliberately small
 * contribution relative to Throne Battle; tune MATERIAL_AVG_WEIGHT below if
 * the event committee wants curriculum performance to matter more — no
 * migration needed, it's just a constant.
 */
const MATERIAL_AVG_WEIGHT = 1;

type EventScoreRow = { value: number | null; parameter: { subCode: string; material: { code: string } } };

function sumByMaterial(rows: EventScoreRow[], materialCode: string): number {
  return rows
    .filter((r) => r.parameter.material.code === materialCode)
    .reduce((sum, r) => sum + (r.value ?? 0), 0);
}

function breakdownByMaterial(rows: EventScoreRow[], materialCode: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.parameter.material.code !== materialCode) continue;
    out[r.parameter.subCode] = r.value ?? 0;
  }
  return out;
}

function pelanggaranTotal(breakdown: Record<string, number>): number {
  let total = 0;
  for (const [subCode, value] of Object.entries(breakdown)) {
    if (PELANGGARAN_EXCLUDED_FROM_TOTAL.has(subCode)) continue;
    total += subCode === PELANGGARAN_TELAT_SUBCODE && value > 5 ? value * 2 : value;
  }
  return total;
}

export type UnitEventBoardRow = {
  unitId: string;
  unitCode: string;
  unitName: string;
  regionId: string;
  regionCode: string;
  regionName: string;
  teraktif: number;
  terdisiplinRaw: number;
  pelanggaranBreakdown: Record<string, number>;
  pelanggaranTotal: number;
  throneBattleWinner: boolean;
  regionTerkompakScore: number;
  materialAvg: number | null;
  materialScoreCount: number;
  terbaikScore: number;
  terdisiplinScore: number;
  terkompakScore: number;
};

export type RegionEventBoardRow = {
  regionId: string;
  regionCode: string;
  regionName: string;
  terkompakBreakdown: Record<string, boolean>;
  terkompakRaw: number;
  terkompakCriteriaCount: number;
  terkompakScore: number;
};

async function getRegionTerkompakScores(): Promise<Map<string, RegionEventBoardRow>> {
  const [regions, regionScores, terkompakParams] = await Promise.all([
    prisma.region.findMany({ select: { id: true, code: true, name: true } }),
    prisma.regionEventScore.findMany({
      select: { regionId: true, value: true, parameter: { select: { subCode: true, material: { select: { code: true } } } } },
    }),
    prisma.parameter.findMany({
      where: { material: { code: MATERIAL.TERKOMPAK }, active: true },
      select: { id: true },
    }),
  ]);

  // Doubling threshold = how many Terkompak criteria currently exist (not how
  // many a region happens to have filled in) — so it stays "all criteria met"
  // even after an Admin adds/removes a criterion later, not pinned at a
  // stale literal 5.
  const criteriaCount = terkompakParams.length;

  const byRegion = new Map<string, RegionEventBoardRow>();
  for (const region of regions) {
    const rowsForRegion = regionScores.filter((s) => s.regionId === region.id) as EventScoreRow[];
    const breakdownRaw = breakdownByMaterial(rowsForRegion, MATERIAL.TERKOMPAK);
    const terkompakBreakdown: Record<string, boolean> = {};
    for (const [subCode, value] of Object.entries(breakdownRaw)) terkompakBreakdown[subCode] = value > 0;
    const terkompakRaw = sumByMaterial(rowsForRegion, MATERIAL.TERKOMPAK);
    const terkompakScore = criteriaCount > 0 && terkompakRaw === criteriaCount ? terkompakRaw * 2 : terkompakRaw;

    byRegion.set(region.id, {
      regionId: region.id,
      regionCode: region.code,
      regionName: region.name,
      terkompakBreakdown,
      terkompakRaw,
      terkompakCriteriaCount: criteriaCount,
      terkompakScore,
    });
  }
  return byRegion;
}

/** Region leaderboard for the Terkompak award — one row per region, sorted highest first. */
export async function getRegionLeaderboard(): Promise<RegionEventBoardRow[]> {
  const byRegion = await getRegionTerkompakScores();
  return Array.from(byRegion.values()).sort((a, b) => b.terkompakScore - a.terkompakScore);
}

/** Unit leaderboard for the Terbaik & Terdisiplin awards — one row per unit (140), sorted by Terbaik highest first. */
export async function getUnitLeaderboard(): Promise<UnitEventBoardRow[]> {
  const [units, unitScores, curriculumScores, regionTerkompak] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, code: true, name: true, regionId: true, region: { select: { code: true, name: true } } } }),
    prisma.unitEventScore.findMany({
      select: { unitId: true, value: true, parameter: { select: { subCode: true, material: { select: { code: true } } } } },
    }),
    prisma.score.findMany({
      where: { parameter: { material: { code: { in: CURRICULUM_MATERIAL_CODES } } }, value: { not: null }, student: { active: true } },
      select: { value: true, student: { select: { unitId: true } } },
    }),
    getRegionTerkompakScores(),
  ]);

  const materialAggByUnit = new Map<string, { sum: number; count: number }>();
  for (const score of curriculumScores) {
    const unitId = score.student.unitId;
    const agg = materialAggByUnit.get(unitId) ?? { sum: 0, count: 0 };
    agg.sum += score.value ?? 0;
    agg.count += 1;
    materialAggByUnit.set(unitId, agg);
  }

  return units
    .map((unit): UnitEventBoardRow => {
      const rowsForUnit = unitScores.filter((s) => s.unitId === unit.id) as EventScoreRow[];
      const teraktif = sumByMaterial(rowsForUnit, MATERIAL.TERAKTIF);
      const terdisiplinRaw = sumByMaterial(rowsForUnit, MATERIAL.TERDISIPLIN);
      const pelanggaranBreakdown = breakdownByMaterial(rowsForUnit, MATERIAL.PELANGGARAN);
      const pelanggaranTotalValue = pelanggaranTotal(pelanggaranBreakdown);
      const throneBattleWinner = sumByMaterial(rowsForUnit, MATERIAL.THRONE_BATTLE) > 0;

      const regionTerkompakScore = regionTerkompak.get(unit.regionId)?.terkompakScore ?? 0;

      const materialAgg = materialAggByUnit.get(unit.id);
      const materialAvg = materialAgg && materialAgg.count > 0 ? Number((materialAgg.sum / materialAgg.count).toFixed(3)) : null;

      const terbaikScore =
        teraktif * 2 +
        terdisiplinRaw +
        (throneBattleWinner ? THRONE_BATTLE_BONUS : 0) -
        pelanggaranTotalValue +
        regionTerkompakScore +
        (materialAvg ?? 0) * MATERIAL_AVG_WEIGHT;

      const terdisiplinScore = terdisiplinRaw - pelanggaranTotalValue;
      const terkompakScore = teraktif + regionTerkompakScore;

      return {
        unitId: unit.id,
        unitCode: unit.code,
        unitName: unit.name,
        regionId: unit.regionId,
        regionCode: unit.region.code,
        regionName: unit.region.name,
        teraktif,
        terdisiplinRaw,
        pelanggaranBreakdown,
        pelanggaranTotal: pelanggaranTotalValue,
        throneBattleWinner,
        regionTerkompakScore,
        materialAvg,
        materialScoreCount: materialAgg?.count ?? 0,
        terbaikScore: Number(terbaikScore.toFixed(3)),
        terdisiplinScore,
        terkompakScore,
      };
    })
    .sort((a, b) => b.terbaikScore - a.terbaikScore);
}
