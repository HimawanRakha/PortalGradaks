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
  score: number | null; // null = no applicable weighted items at all yet
  items: WeightedItem[];
};

export type ComputedScores = {
  personal: BucketResult;
  skill: BucketResult;
  computedAt: string;
};

async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  return typeof row.value === "number" ? row.value : fallback;
}

/**
 * Weighted AVERAGE, not weighted sum — deliberately. Weights below are
 * relative-importance numbers that do not need to sum to 1; dividing by
 * their total keeps the result on a stable 0-100 scale no matter how many
 * parameters PSDM adds or removes over time via Master Data.
 */
function weightedAverage(items: WeightedItem[]): number | null {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;
  const totalWeighted = items.reduce((sum, item) => sum + item.normalizedValue * item.weight, 0);
  return totalWeighted / totalWeight;
}

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

/**
 * Computes both final numbers for one student from live data. Safe to
 * call anytime as a preview (nothing is persisted here) — finalization
 * just calls this once more and freezes the result into RaportSnapshot.
 * Personality profile is deliberately never read here — descriptive only,
 * per the brief's standing risk-mitigation decision.
 */
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
      attendances: { select: { status: true, participationScore: true } },
      logbookEntries: { select: { status: true } },
      questionnaireStatuses: { select: { code: true, submitted: true } },
    },
  });

  const [attendancePersonalW, attendanceSkillW, logbookPersonalW, logbookSkillW, k1SkillW, k2SkillW] =
    await Promise.all([
      getNumberSetting(SETTING_KEYS.attendancePersonal, 0),
      getNumberSetting(SETTING_KEYS.attendanceSkill, 0),
      getNumberSetting(SETTING_KEYS.logbookPersonal, 0),
      getNumberSetting(SETTING_KEYS.logbookSkill, 0),
      getNumberSetting(SETTING_KEYS.k1Skill, 0),
      getNumberSetting(SETTING_KEYS.k2Skill, 0),
    ]);

  const personalItems: WeightedItem[] = [];
  const skillItems: WeightedItem[] = [];

  function pushParamItem(value: number | null, param: ParamWeights) {
    if (value === null) return;
    const normalized = normalize(value, param.maxValue);
    const pw = param.personalWeight === null ? null : Number(param.personalWeight);
    const sw = param.skillWeight === null ? null : Number(param.skillWeight);
    if (pw) {
      personalItems.push({
        label: param.name,
        refCode: param.subCode,
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
        refCode: param.subCode,
        rawValue: value,
        maxValue: param.maxValue,
        normalizedValue: normalized,
        weight: sw,
        weightedContribution: normalized * sw,
      });
    }
  }

  for (const score of student.scores) {
    pushParamItem(score.value, score.parameter);
  }

  for (const membership of student.groupMemberships) {
    for (const groupScore of membership.group.groupScores) {
      pushParamItem(groupScore.value, groupScore.parameter);
    }
  }

  // Attendance: ALPA = 0 credit, IZIN = half credit, HADIR = full participation credit.
  if (attendancePersonalW > 0 || attendanceSkillW > 0) {
    for (const attendance of student.attendances) {
      const base = attendance.participationScore ?? 0;
      const effective = attendance.status === "ALPA" ? 0 : attendance.status === "IZIN" ? base * 0.5 : base;
      const normalized = normalize(effective, 4);
      if (attendancePersonalW > 0) {
        personalItems.push({
          label: "Kehadiran & Keaktifan",
          refCode: "ATTENDANCE",
          rawValue: effective,
          maxValue: 4,
          normalizedValue: normalized,
          weight: attendancePersonalW,
          weightedContribution: normalized * attendancePersonalW,
        });
      }
      if (attendanceSkillW > 0) {
        skillItems.push({
          label: "Kehadiran & Keaktifan",
          refCode: "ATTENDANCE",
          rawValue: effective,
          maxValue: 4,
          normalizedValue: normalized,
          weight: attendanceSkillW,
          weightedContribution: normalized * attendanceSkillW,
        });
      }
    }
  }

  // Logbook contributes ONE aggregate completion-ratio item, not one item
  // per entry — otherwise a student with more logged activities would
  // mechanically outscore one with fewer, regardless of quality.
  if (student.logbookEntries.length > 0) {
    const completeCount = student.logbookEntries.filter((entry) => entry.status === "LENGKAP").length;
    const normalized = (completeCount / student.logbookEntries.length) * 100;
    if (logbookPersonalW > 0) {
      personalItems.push({
        label: "Kelengkapan Logbook",
        refCode: "LOGBOOK",
        rawValue: completeCount,
        maxValue: student.logbookEntries.length,
        normalizedValue: normalized,
        weight: logbookPersonalW,
        weightedContribution: normalized * logbookPersonalW,
      });
    }
    if (logbookSkillW > 0) {
      skillItems.push({
        label: "Kelengkapan Logbook",
        refCode: "LOGBOOK",
        rawValue: completeCount,
        maxValue: student.logbookEntries.length,
        normalizedValue: normalized,
        weight: logbookSkillW,
        weightedContribution: normalized * logbookSkillW,
      });
    }
  }

  // K1/K2 contribute by submission completion (brief defines no scoring
  // rubric for questionnaire content — they're primarily pre/post delta
  // inputs for external SPSS analysis). Set the weight to 0 in Settings to
  // exclude either from the score entirely if PSDM decides that's correct.
  for (const questionnaire of student.questionnaireStatuses) {
    const weight = questionnaire.code === "K1" ? k1SkillW : k2SkillW;
    if (weight <= 0) continue;
    const normalized = questionnaire.submitted ? 100 : 0;
    skillItems.push({
      label: questionnaire.code === "K1" ? "Kuesioner Baseline (K1)" : "Kuesioner Refleksi (K2)",
      refCode: questionnaire.code,
      rawValue: normalized,
      maxValue: 100,
      normalizedValue: normalized,
      weight,
      weightedContribution: normalized * weight,
    });
  }

  return {
    personal: { score: weightedAverage(personalItems), items: personalItems },
    skill: { score: weightedAverage(skillItems), items: skillItems },
    computedAt: new Date().toISOString(),
  };
}
