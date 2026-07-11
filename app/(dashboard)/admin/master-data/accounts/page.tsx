import type { Metadata } from "next";
import { assertCanManageMasterData } from "@/lib/auth/dal";
import { getAllAccounts, getRegionOptions, getUnitOptionsWithMentor } from "@/lib/data/master-data";
import { MasterDataSectionNav } from "@/components/master-data/section-nav";
import { AccountsManager } from "@/components/master-data/accounts-manager";

export const metadata: Metadata = { title: "Kelola Akun - Master Data" };

export default async function AccountsPage() {
  await assertCanManageMasterData();
  const [users, regions, rawUnits] = await Promise.all([
    getAllAccounts(),
    getRegionOptions(),
    getUnitOptionsWithMentor(),
  ]);

  // Clean unit types to prevent build warnings
  const units = rawUnits.map((u) => ({
    id: u.id,
    code: u.code,
    name: u.name,
    region: {
      id: u.region.id,
      code: u.region.code,
      name: u.region.name,
    },
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Master Data</h2>
        <p className="text-sm text-muted-foreground">
          Kelola akun PSDM/Admin, Kepala Region, Mentor, dan Damen.
        </p>
      </div>

      <MasterDataSectionNav />

      <AccountsManager initialUsers={users} regions={regions} units={units} />
    </div>
  );
}
