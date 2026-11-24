import "server-only";
import { prisma } from "@/lib/prisma";
import { RecommendationKind, RuleOperator } from "@/app/generated/prisma/enums";
import type { ComputedScores } from "./calculate";
import type { K1Interest } from "./k1";

const FALLBACK_RECOMMENDATION = "Belum ada rekomendasi yang sesuai — hubungi PSDM";

export type RecommendationRuleForEval = {
  metric: string;
  kind: RecommendationKind;
  operator: RuleOperator;
  value: unknown;
  valueTo: unknown;
  recommendationText: string | null;
  descriptionText: string | null;
  order: number;
};

export async function getActiveRecommendationRulesForEvaluation(): Promise<RecommendationRuleForEval[]> {
  return prisma.recommendationRule.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: { metric: true, kind: true, operator: true, value: true, valueTo: true, recommendationText: true, descriptionText: true, order: true },
  });
}

/**
 * Reads a rule's target metric straight from ComputedScores — a pure lookup,
 * not a re-derivation of calculate.ts's classification logic. Returns null
 * for a student with no data in that bucket (calculate.ts already treats
 * missing components as "excluded from the average" rather than an error;
 * a rule referencing a null metric should likewise just never match, never
 * throw — see evaluateRecommendation).
 */
export function resolveMetric(computed: ComputedScores, metric: string): number | null {
  switch (metric) {
    case "PERSONAL_SCORE":
      return computed.personal.score;
    case "SKILL_SCORE":
      return computed.skill.score;
    case "PERSONAL_KOLEKTIF":
      return computed.personal.groups.find((g) => g.code === "A")?.score ?? null;
    case "PERSONAL_KOLABORASI":
      return computed.personal.groups.find((g) => g.code === "B")?.score ?? null;
    case "PERSONAL_KONTRIBUSI":
      return computed.personal.groups.find((g) => g.code === "C")?.score ?? null;
    case "SKILL_MANAJERIAL":
      return computed.skill.categories.find((c) => c.code === "M")?.score ?? null;
    case "SKILL_KEILMIAHAN":
      return computed.skill.categories.find((c) => c.code === "K")?.score ?? null;
    case "SKILL_MINAT_BAKAT":
      return computed.skill.categories.find((c) => c.code === "MB")?.score ?? null;
    case "SKILL_KEWIRAUSAHAAN":
      return computed.skill.categories.find((c) => c.code === "KW")?.score ?? null;
    case "SUB_A1":
    case "SUB_A2":
    case "SUB_B1":
    case "SUB_B2":
    case "SUB_C1":
    case "SUB_C2": {
      const code = `${metric[4]}.${metric[5]}`;
      return computed.personal.groups.flatMap((g) => g.subNilai).find((x) => x.code === code)?.score ?? null;
    }
    default:
      return null;
  }
}

export function matchesOperator(rawActual: number, operator: RuleOperator, value: number, valueTo: number | null): boolean {
  // Rule thresholds are stored with 2 decimals (e.g. 70-84.99, then >= 85), so a
  // score like 84.998 would fall between two ranges and match neither. Truncate
  // to 2 decimals, which also keeps it on the same side as its predikat.
  const actual = Math.floor(rawActual * 100 + 1e-9) / 100;
  switch (operator) {
    case RuleOperator.LT:
      return actual < value;
    case RuleOperator.LTE:
      return actual <= value;
    case RuleOperator.GT:
      return actual > value;
    case RuleOperator.GTE:
      return actual >= value;
    case RuleOperator.BETWEEN:
      // Defensive: a BETWEEN rule with no valueTo (shouldn't happen — the
      // admin form requires it for this operator) never matches rather
      // than throwing, so one malformed rule can't abort a finalization run.
      if (valueTo === null) return false;
      return actual >= value && actual <= valueTo;
    default:
      return false;
  }
}

const SKILL_METRIC: Record<string, string> = { M: "SKILL_MANAJERIAL", K: "SKILL_KEILMIAHAN", MB: "SKILL_MINAT_BAKAT", KW: "SKILL_KEWIRAUSAHAAN" };
// Truncated (not rounded) so a 84.998 never reads "85,0" next to the "Baik" band it belongs to.
const fmt1 = (v: number) => (Math.floor(v * 10 + 1e-9) / 10).toFixed(1).replace(".", ",");
/** "A", "A dan B", "A, B, dan C". */
const joinId = (xs: string[]) => (xs.length <= 2 ? xs.join(" dan ") : `${xs.slice(0, -1).join(", ")}, dan ${xs[xs.length - 1]}`);

function ruleMatches(computed: ComputedScores, rule: RecommendationRuleForEval): boolean {
  const actual = resolveMetric(computed, rule.metric);
  if (actual === null) return false;
  const value = Number(rule.value);
  const valueTo = rule.valueTo === null || rule.valueTo === undefined ? null : Number(rule.valueTo);
  if (Number.isNaN(value) || (valueTo !== null && Number.isNaN(valueTo))) return false;
  return matchesOperator(actual, rule.operator, value, valueTo);
}

/**
 * Builds the raport's conclusion ("hasil selama pengembangan"). Never throws
 * for any rule/metric/student combination — finalizeRaportsAction's
 * per-student loop has no per-student try/catch, so one bad rule or one
 * null sub-score must not abort the whole batch.
 *
 * - recommendation (the raport's headline) = the maba's top bidang keahlian
 *   by MENTOR EVALUATION (ties broken by the bidang score), e.g. "Bidang
 *   Keilmiahan". The mentor evaluation is used rather than the bidang score
 *   because the score's 20% kegiatan part favours Manajerial structurally
 *   (Penilaian Manajerial vs optional Kegiatan Keahlian).
 * - description = (1) the TOP_SKILL rule text of that bidang plus a comparison
 *   with the interest the maba stated in Kuesioner 1 (when usable), then (2) the
 *   Nilai Personal result: the first matching HEADLINE rule's
 *   recommendationText as its predikat label plus every matching HEADLINE
 *   descriptionText. Paragraphs are separated by a blank line.
 * If no bidang has a score, the headline falls back to the Nilai Personal label.
 */
export function evaluateRecommendation(
  computed: ComputedScores,
  rules: RecommendationRuleForEval[],
  k1: K1Interest | null = null,
): { recommendation: string; description: string | null } {
  const sorted = [...rules].sort((a, b) => a.order - b.order);

  // (1) Top bidang keahlian: mentor evaluation first, bidang score as tie-break.
  const scored = computed.skill.categories.filter((c) => c.score !== null) as Array<(typeof computed.skill.categories)[number] & { score: number }>;
  const mentor = (c: (typeof scored)[number]) => c.mentorScore ?? -1;
  const bestMentor = scored.length ? Math.max(...scored.map(mentor)) : null;
  const byMentor = bestMentor === null ? [] : scored.filter((c) => Math.abs(mentor(c) - bestMentor) < 1e-9);
  const bestScore = byMentor.length ? Math.max(...byMentor.map((c) => c.score)) : null;
  const top = bestScore === null ? [] : byMentor.filter((c) => Math.abs(c.score - bestScore) < 1e-9);
  const parts: string[] = [];
  if (top.length > 0) {
    const names = top.map((c) => c.label);
    const intro =
      bestMentor !== null && bestMentor >= 0
        ? `Berdasarkan evaluasi mentor, potensi utama Anda berada pada bidang ${joinId(names)}.`
        : `Potensi utama Anda berada pada bidang ${joinId(names)} (nilai ${fmt1(bestScore!)}).`;
    const texts = top
      .map((c) => sorted.find((r) => r.kind === RecommendationKind.TOP_SKILL && r.metric === SKILL_METRIC[c.code] && ruleMatches(computed, r)))
      .map((r) => r?.descriptionText?.trim())
      .filter((t): t is string => !!t);
    // Comparison with the interest stated at the start of the program (Kuesioner 1).
    if (k1?.valid && k1.minatDominan.length > 0) {
      texts.push(
        k1.minatDominan.some((d) => names.includes(d))
          ? "Hal ini sejalan dengan minat yang Anda nyatakan pada Kuesioner 1."
          : `Pada awal rangkaian (Kuesioner 1), Anda menyatakan minat tertinggi pada bidang ${joinId(k1.minatDominan)}; bidang tersebut juga dapat Anda eksplorasi lebih lanjut.`,
      );
    }
    parts.push([intro, ...texts].join(" "));
  }

  // (2) Nilai Personal result.
  let personalLabel: string | null = null;
  const personalTexts: string[] = [];
  for (const rule of sorted) {
    if (rule.kind !== RecommendationKind.HEADLINE || !ruleMatches(computed, rule)) continue;
    if (personalLabel === null && rule.recommendationText) personalLabel = rule.recommendationText;
    if (rule.descriptionText?.trim()) personalTexts.push(rule.descriptionText.trim());
  }
  if (personalLabel || personalTexts.length) {
    const np = computed.personal.score;
    const head = `Hasil pengembangan personal${np === null ? "" : ` (Nilai Personal ${fmt1(np)})`}${personalLabel ? `: ${personalLabel}.` : ":"}`;
    parts.push([head, ...personalTexts].join(" "));
  }

  const recommendation = top.length > 0 ? `Bidang ${joinId(top.map((c) => c.label))}` : personalLabel;
  return {
    recommendation: recommendation ?? FALLBACK_RECOMMENDATION,
    description: parts.length > 0 ? parts.join("\n\n") : null,
  };
}
