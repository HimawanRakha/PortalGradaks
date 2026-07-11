import type { Metadata } from "next";
import { assertCanManageMasterData } from "@/lib/auth/dal";
import { getMaterialsWithActivity, getActivityOptions } from "@/lib/data/master-data";
import { MasterDataSectionNav } from "@/components/master-data/section-nav";
import { MaterialsManager } from "@/components/master-data/materials-manager";

export const metadata: Metadata = { title: "Kelola Materi - Master Data" };

export default async function MaterialsPage() {
  await assertCanManageMasterData();
  const [materials, activities] = await Promise.all([
    getMaterialsWithActivity(),
    getActivityOptions(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Master Data</h2>
        <p className="text-sm text-muted-foreground">
          Kelola materi pembelajaran yang tergabung dalam setiap alur kegiatan.
        </p>
      </div>

      <MasterDataSectionNav />

      <MaterialsManager initialMaterials={materials} activities={activities} />
    </div>
  );
}
