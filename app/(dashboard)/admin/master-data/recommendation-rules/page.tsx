import type { Metadata } from "next";
import { assertCanManageMasterData } from "@/lib/auth/dal";
import { getRecommendationRules, decimalToNumber } from "@/lib/data/master-data";
import { MasterDataSectionNav } from "@/components/master-data/section-nav";
import { RecommendationRulesManager } from "@/components/master-data/recommendation-rules-manager";

export const metadata: Metadata = { title: "Rule Rekomendasi - Master Data" };

export default async function RecommendationRulesPage() {
  await assertCanManageMasterData();
  const rawRules = await getRecommendationRules();

  const rules = rawRules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    metric: rule.metric,
    operator: rule.operator,
    value: decimalToNumber(rule.value) ?? 0,
    valueTo: decimalToNumber(rule.valueTo),
    recommendationText: rule.recommendationText,
    descriptionText: rule.descriptionText,
    order: rule.order,
    active: rule.active,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Master Data</h2>
        <p className="text-sm text-muted-foreground">
          Kelola rule rekomendasi &amp; deskripsi otomatis untuk raport maba.
        </p>
      </div>

      <MasterDataSectionNav />

      <RecommendationRulesManager initialRules={rules} />
    </div>
  );
}
