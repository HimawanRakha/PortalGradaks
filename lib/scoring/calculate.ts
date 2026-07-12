import "server-only";
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS } from "./setting-keys";

export { SETTING_KEYS };

export type WeightedItem = {
  label: string;
  refCode: string;
  rawValue: number;
  maxValue: number;
  normalizedValue: number; // 0-100
  weight: number;
  weightedContribution: number;
};

export type BucketResult = {
  score: number | null;
  items: WeightedItem[];
  breakdown: Record<string, number | null>;
};

// Labeled hierarchy for "Nilai Personal": 3 top-level Nilai (Kolektif/
// Kolaborasi/Kontribusi), each made of 2 named Sub-Nilai. Every group's own
// `score` is a weighted average of its 2 children using the same fixed
// weights as the flat `breakdown` map — mathematically identical to the
// overall `personal.score` (weighted-avg-of-weighted-avgs with consistent
// nested weights collapses to the same flat weighted average), so this is
// purely an additional, more legible view of the same numbers.
export type SubNilai = { code: string; label: string; weight: number; score: number | null };
export type NilaiGroup = { code: string; label: string; weight: number; score: number | null; subNilai: SubNilai[] };
export type SkillCategory = { code: string; label: string; score: number | null };

export type ComputedScores = {
  personal: BucketResult & { groups: NilaiGroup[] };
  skill: BucketResult & { categories: SkillCategory[] };
  computedAt: string;
};

function normalize(value: number, max: number): number {
  const safeMax = max > 0 ? max : 1;
  return (Math.max(0, Math.min(value, safeMax)) / safeMax) * 100;
}

type ParamWeights = {
  subCode: string;
  name: string;
  personalWeight: unknown;
  skillWeight: unknown;
  maxValue: number;
};

export async function computeScores(studentId: string): Promise<ComputedScores> {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      scores: {
        select: {
          value: true,
          parameter: {
            select: { subCode: true, name: true, personalWeight: true, skillWeight: true, maxValue: true },
          },
        },
      },
      groupMemberships: {
        select: {
          group: {
            select: {
              groupScores: {
                select: {
                  value: true,
                  parameter: {
                    select: { subCode: true, name: true, personalWeight: true, skillWeight: true, maxValue: true },
                  },
                },
              },
            },
          },
        },
      },
      attendances: {
        select: {
          status: true,
          participationScore: true,
          session: { select: { code: true } },
        },
      },
      logbookEntries: { select: { status: true } },
      questionnaireStatuses: { select: { code: true, submitted: true } },
    },
  });

  const personalItems: WeightedItem[] = [];
  const skillItems: WeightedItem[] = [];

  // Arrays for collecting normalized scores for each sub-value
  const a1Scores: number[] = [];
  const a2Scores: number[] = [];
  const b1Scores: number[] = [];
  const b2Scores: number[] = [];
  const c1Scores: number[] = [];
  const c2Scores: number[] = [];

  const manajerialScores: number[] = [];
  const keilmiahanScores: number[] = [];
  const minatBakatScores: number[] = [];
  const kewirausahaanScores: number[] = [];

  // Helper to add scores to correct buckets based on parameter subCode
  function addScoreToBuckets(value: number, subCode: string, maxValue: number) {
    const norm = normalize(value, maxValue);
    const upper = subCode.toUpperCase().replace(/\s+/g, "");

    if (upper.includes("A.1") || upper.includes("A1")) a1Scores.push(norm);
    if (upper.includes("A.2") || upper.includes("A2")) a2Scores.push(norm);
    if (upper.includes("B.1") || upper.includes("B1")) b1Scores.push(norm);
    if (upper.includes("B.2") || upper.includes("B2")) b2Scores.push(norm);
    if (upper.includes("C.1") || upper.includes("C1")) c1Scores.push(norm);
    if (upper.includes("C.2") || upper.includes("C2")) c2Scores.push(norm);

    // Skill categories are matched on the subCode's prefix before its first
    // "_"/"." (e.g. "M", "M_1", "M_2" all prefix to "M") — exact-equal on the
    // whole subCode instead of this prefix would break as soon as a category
    // has more than one hidden parameter (Keaktifan/Minat/Potensi under each
    // of Manajerial/Keilmiahan/Minat Bakat/Kewirausahaan). Comparing the
    // prefix rather than doing a plain `.includes("M")` avoids "MB_1"/"KW_1"
    // wrongly also matching "M"/"K".
    const skillPrefix = upper.split(/[._]/)[0];
    if (skillPrefix === "MB") {
      minatBakatScores.push(norm);
    } else if (skillPrefix === "M") {
      manajerialScores.push(norm);
    }

    if (skillPrefix === "KW") {
      kewirausahaanScores.push(norm);
    } else if (skillPrefix === "K") {
      keilmiahanScores.push(norm);
    }
  }

  function pushParamItem(value: number | null, param: ParamWeights) {
    if (value === null) return;
    const normalized = normalize(value, param.maxValue);
    const pw = param.personalWeight === null ? null : Number(param.personalWeight);
    const sw = param.skillWeight === null ? null : Number(param.skillWeight);

    addScoreToBuckets(value, param.subCode, param.maxValue);

    const refCode = param.subCode;

    if (pw) {
      personalItems.push({
        label: param.name,
        refCode,
        rawValue: value,
        maxValue: param.maxValue,
        normalizedValue: normalized,
        weight: pw,
        weightedContribution: normalized * pw,
      });
    }
    if (sw) {
      skillItems.push({
        label: param.name,
        refCode,
        rawValue: value,
        maxValue: param.maxValue,
        normalizedValue: normalized,
        weight: sw,
        weightedContribution: normalized * sw,
      });
    }
  }

  // 1. Process regular scores
  for (const score of student.scores) {
    pushParamItem(score.value, score.parameter);
  }

  // 2. Process group scores
  for (const membership of student.groupMemberships) {
    for (const groupScore of membership.group.groupScores) {
      pushParamItem(groupScore.value, groupScore.parameter);
    }
  }

  // 3. Process regular and proker attendances
  for (const attendance of student.attendances) {
    const sessionCode = attendance.session.code.toUpperCase();
    const isProker = ["PESRAF", "DIESNAT", "ARUS_EMAS", "SOSCOM", "COMPANY_EXPO"].includes(sessionCode);

    const base = attendance.participationScore ?? 0;
    const effective = attendance.status === "ALPA" ? 0 : attendance.status === "IZIN" ? base * 0.5 : base;

    // Add for backward compatibility of attendance reports / min criteria checking
    personalItems.push({
      label: `Kehadiran Sesi (${sessionCode})`,
      refCode: "ATTENDANCE",
      rawValue: attendance.status === "HADIR" ? base : attendance.status === "IZIN" ? 2 : 0,
      maxValue: 4,
      normalizedValue: attendance.status === "HADIR" ? 100 : attendance.status === "IZIN" ? 50 : 0,
      weight: 0,
      weightedContribution: 0,
    });

    if (isProker) {
      const statusVal = attendance.status;
      const score = statusVal === "HADIR" ? 100 : statusVal === "IZIN" ? 50 : 0;

      if (sessionCode === "PESRAF") {
        a1Scores.push(score);
      } else if (sessionCode === "DIESNAT") {
        a2Scores.push(score);
      } else if (sessionCode === "ARUS_EMAS") {
        a1Scores.push(score);
        a2Scores.push(score);
      } else if (sessionCode === "SOSCOM") {
        a1Scores.push(score);
        b2Scores.push(score);
        c2Scores.push(score);
      } else if (sessionCode === "COMPANY_EXPO") {
        b1Scores.push(score);
        c2Scores.push(score);
      }
    } else {
      // Regular session attendance: Kehadiran is A.1, Keaktifan is B.2 and C.1
      const attendanceNormalized = normalize(effective, 4);

      a1Scores.push(attendance.status === "HADIR" ? 100 : attendance.status === "IZIN" ? 50 : 0);

      if (attendance.status === "HADIR" && attendance.participationScore !== null) {
        b2Scores.push(attendanceNormalized);
        c1Scores.push(attendanceNormalized);
      }
    }
  }

  // Helper to calculate average
  const getAverage = (list: number[]) =>
    list.length > 0 ? Number((list.reduce((a, b) => a + b, 0) / list.length).toFixed(3)) : null;

  const a1 = getAverage(a1Scores);
  const a2 = getAverage(a2Scores);
  const b1 = getAverage(b1Scores);
  const b2 = getAverage(b2Scores);
  const c1 = getAverage(c1Scores);
  const c2 = getAverage(c2Scores);

  const m = getAverage(manajerialScores);
  const k = getAverage(keilmiahanScores);
  const mb = getAverage(minatBakatScores);
  const kw = getAverage(kewirausahaanScores);

  // Collective sub-value weights for Nilai Personal
  const personalWeights = {
    a1: 0.020,
    a2: 0.3787,
    b1: 0.2609,
    b2: 0.1755,
    c1: 0.1172,
    c2: 0.0476,
  };

  let personalScoreSum = 0;
  let personalWeightSum = 0;

  if (a1 !== null) { personalScoreSum += a1 * personalWeights.a1; personalWeightSum += personalWeights.a1; }
  if (a2 !== null) { personalScoreSum += a2 * personalWeights.a2; personalWeightSum += personalWeights.a2; }
  if (b1 !== null) { personalScoreSum += b1 * personalWeights.b1; personalWeightSum += personalWeights.b1; }
  if (b2 !== null) { personalScoreSum += b2 * personalWeights.b2; personalWeightSum += personalWeights.b2; }
  if (c1 !== null) { personalScoreSum += c1 * personalWeights.c1; personalWeightSum += personalWeights.c1; }
  if (c2 !== null) { personalScoreSum += c2 * personalWeights.c2; personalWeightSum += personalWeights.c2; }

  const personalScore = personalWeightSum > 0 ? Number((personalScoreSum / personalWeightSum).toFixed(3)) : null;

  // Simple average for Nilai Keahlian
  let skillScoreSum = 0;
  let skillCount = 0;

  if (m !== null) { skillScoreSum += m; skillCount++; }
  if (k !== null) { skillScoreSum += k; skillCount++; }
  if (mb !== null) { skillScoreSum += mb; skillCount++; }
  if (kw !== null) { skillScoreSum += kw; skillCount++; }

  const skillScore = skillCount > 0 ? Number((skillScoreSum / skillCount).toFixed(3)) : null;

  const groupScore = (children: Array<{ value: number | null; weight: number }>): number | null => {
    let sum = 0;
    let weightSum = 0;
    for (const child of children) {
      if (child.value === null) continue;
      sum += child.value * child.weight;
      weightSum += child.weight;
    }
    return weightSum > 0 ? Number((sum / weightSum).toFixed(3)) : null;
  };

  const groups: NilaiGroup[] = [
    {
      code: "A",
      label: "Kolektif",
      weight: 0.399,
      score: groupScore([
        { value: a1, weight: personalWeights.a1 },
        { value: a2, weight: personalWeights.a2 },
      ]),
      subNilai: [
        { code: "A.1", label: "Kebersamaan", weight: personalWeights.a1, score: a1 },
        { code: "A.2", label: "Kebanggan Fakultas", weight: personalWeights.a2, score: a2 },
      ],
    },
    {
      code: "B",
      label: "Kolaborasi",
      weight: 0.4364,
      score: groupScore([
        { value: b1, weight: personalWeights.b1 },
        { value: b2, weight: personalWeights.b2 },
      ]),
      subNilai: [
        { code: "B.1", label: "Manajemen Diri (emosi/waktu)", weight: personalWeights.b1, score: b1 },
        { code: "B.2", label: "Kerja sama", weight: personalWeights.b2, score: b2 },
      ],
    },
    {
      code: "C",
      label: "Kontribusi",
      weight: 0.1648,
      score: groupScore([
        { value: c1, weight: personalWeights.c1 },
        { value: c2, weight: personalWeights.c2 },
      ]),
      subNilai: [
        { code: "C.1", label: "Problem Solving", weight: personalWeights.c1, score: c1 },
        { code: "C.2", label: "Kepekaan Sosial", weight: personalWeights.c2, score: c2 },
      ],
    },
  ];

  const categories: SkillCategory[] = [
    { code: "M", label: "Manajerial", score: m },
    { code: "K", label: "Keilmiahan", score: k },
    { code: "MB", label: "Minat Bakat", score: mb },
    { code: "KW", label: "Kewirausahaan", score: kw },
  ];

  return {
    personal: {
      score: personalScore,
      items: personalItems,
      breakdown: { a1, a2, b1, b2, c1, c2 },
      groups,
    },
    skill: {
      score: skillScore,
      items: skillItems,
      breakdown: { manajerial: m, keilmiahan: k, minatBakat: mb, kewirausahaan: kw },
      categories,
    },
    computedAt: new Date().toISOString(),
  };
}
