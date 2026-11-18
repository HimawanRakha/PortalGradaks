import { RecommendationKind, type RecommendationMetric } from "@/app/generated/prisma/enums";
import type { ComputedScores } from "./calculate";
import { matchesOperator, resolveMetric, type RecommendationRuleForEval } from "./recommendation";
import { METRIC_RAPORT_LABELS } from "./recommendation-labels";

/**
 * The raport's "Rekomendasi Pengembangan" lists, driven entirely by the
 * Master Data > Rule Rekomendasi rows of kind IMPROVE ("Perlu ditingkatkan")
 * and KEEP ("Potensi untuk dipertahankan dan dieksplorasi lebih dalam").
 * Every matching rule (in `order`) contributes one item: the aspect name,
 * this maba's score on it, and the rule's descriptionText. Never throws, for
 * the same reason as evaluateRecommendation.
 */
export type AspectAdvice = { code: string; label: string; score: number; text: string };
export type AspectRecommendations = { improve: AspectAdvice[]; keep: AspectAdvice[] };

export function buildAspectRecommendations(computed: ComputedScores, rules: RecommendationRuleForEval[]): AspectRecommendations {
  const improve: AspectAdvice[] = [];
  const keep: AspectAdvice[] = [];
  for (const rule of [...rules].sort((a, b) => a.order - b.order)) {
    if ((rule.kind !== RecommendationKind.IMPROVE && rule.kind !== RecommendationKind.KEEP) || !rule.descriptionText?.trim()) continue;
    const score = resolveMetric(computed, rule.metric);
    if (score === null) continue;
    const value = Number(rule.value);
    const valueTo = rule.valueTo === null || rule.valueTo === undefined ? null : Number(rule.valueTo);
    if (Number.isNaN(value) || (valueTo !== null && Number.isNaN(valueTo))) continue;
    if (!matchesOperator(score, rule.operator, value, valueTo)) continue;
    const item = {
      code: rule.metric,
      label: METRIC_RAPORT_LABELS[rule.metric as RecommendationMetric] ?? rule.metric,
      score,
      text: rule.descriptionText.trim(),
    };
    (rule.kind === RecommendationKind.IMPROVE ? improve : keep).push(item);
  }
  return { improve, keep };
}
