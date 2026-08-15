import "server-only";
import { prisma } from "@/lib/prisma";
import { RuleOperator } from "@/app/generated/prisma/enums";
import type { ComputedScores } from "./calculate";

const FALLBACK_RECOMMENDATION = "Belum ada rekomendasi yang sesuai — hubungi PSDM";

export type RecommendationRuleForEval = {
  metric: string;
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
    select: { metric: true, operator: true, value: true, valueTo: true, recommendationText: true, descriptionText: true, order: true },
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
    default:
      return null;
  }
}

function matchesOperator(actual: number, operator: RuleOperator, value: number, valueTo: number | null): boolean {
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

/**
 * Evaluates every active rule against one student's computed scores. Never
 * throws for any rule/metric/student combination — finalizeRaportsAction's
 * per-student loop has no per-student try/catch, so one bad rule or one
 * null sub-score must not abort the whole batch. A rule whose metric
 * resolves to null, or whose numeric fields are malformed, simply doesn't
 * match; it never surfaces as an error.
 *
 * The first matching rule (in `order`) with a non-null recommendationText
 * becomes the headline `recommendation`. Every matching rule's
 * descriptionText (if set) concatenates in order into `description`.
 */
export function evaluateRecommendation(
  computed: ComputedScores,
  rules: RecommendationRuleForEval[],
): { recommendation: string; description: string | null } {
  let recommendation: string | null = null;
  const descriptionParts: string[] = [];

  for (const rule of rules) {
    const actual = resolveMetric(computed, rule.metric);
    if (actual === null) continue;

    const value = Number(rule.value);
    const valueTo = rule.valueTo === null || rule.valueTo === undefined ? null : Number(rule.valueTo);
    if (Number.isNaN(value) || (valueTo !== null && Number.isNaN(valueTo))) continue;

    if (!matchesOperator(actual, rule.operator, value, valueTo)) continue;

    if (recommendation === null && rule.recommendationText) {
      recommendation = rule.recommendationText;
    }
    if (rule.descriptionText) {
      descriptionParts.push(rule.descriptionText);
    }
  }

  return {
    recommendation: recommendation ?? FALLBACK_RECOMMENDATION,
    description: descriptionParts.length > 0 ? descriptionParts.join("\n\n") : null,
  };
}
