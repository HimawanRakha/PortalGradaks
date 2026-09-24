import type { Metadata } from "next";
import { assertCanManageMasterData } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { MasterDataSectionNav } from "@/components/master-data/section-nav";
import { SettingsManager } from "@/components/master-data/settings-manager";

export const metadata: Metadata = { title: "Kelola Pengaturan & Bobot - Master Data" };

export default async function SettingsPage() {
  await assertCanManageMasterData();
  const rawSettings = await prisma.setting.findMany({
    orderBy: { key: "asc" },
  });

  const settings = rawSettings.map((s) => ({
    key: s.key,
    value: s.value as any,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Master Data</h2>
        <p className="text-sm text-muted-foreground">
          Kelola bobot perhitungan raport, deviasi kalibrasi, dan struktur verifikasi kelulusan.
        </p>
      </div>

      <MasterDataSectionNav />

      <SettingsManager initialSettings={settings} />
    </div>
  );
}
