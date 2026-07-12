import type { Metadata } from "next";
import { assertCanManageMasterData } from "@/lib/auth/dal";
import { getParametersWithMaterial, getMaterialOptions, decimalToNumber } from "@/lib/data/master-data";
import { MasterDataSectionNav } from "@/components/master-data/section-nav";
import { ParametersManager } from "@/components/master-data/parameters-manager";

export const metadata: Metadata = { title: "Kelola Parameter - Master Data" };

export default async function ParametersPage() {
  await assertCanManageMasterData();
  const [rawParameters, materials] = await Promise.all([
    getParametersWithMaterial(),
    getMaterialOptions(),
  ]);

  // Convert decimal fields to numbers to prevent serialization errors
  const parameters = rawParameters.map((param) => ({
    id: param.id,
    subCode: param.subCode,
    name: param.name,
    type: param.type,
    personalWeight: decimalToNumber(param.personalWeight),
    skillWeight: decimalToNumber(param.skillWeight),
    maxValue: param.maxValue,
    inputMethod: param.inputMethod,
    order: param.order,
    clusterLabel: param.clusterLabel,
    rubricAnchors: param.rubricAnchors as Record<string, string> | null,
    active: param.active,
    material: {
      id: param.material.id,
      code: param.material.code,
      name: param.material.name,
      activity: {
        id: param.material.activity.id,
        code: param.material.activity.code,
        name: param.material.activity.name,
      },
    },
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Master Data</h2>
        <p className="text-sm text-muted-foreground">
          Kelola parameter penilaian, bobot hitung, tipe scoring, dan standar rubrik.
        </p>
      </div>

      <MasterDataSectionNav />

      <ParametersManager initialParameters={parameters} materials={materials} />
    </div>
  );
}
