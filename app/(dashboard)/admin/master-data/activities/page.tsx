import type { Metadata } from "next";
import { assertCanManageMasterData } from "@/lib/auth/dal";
import { getActivitiesWithSessions, decimalToNumber } from "@/lib/data/master-data";
import { MasterDataSectionNav } from "@/components/master-data/section-nav";
import { ActivitiesManager } from "@/components/master-data/activities-manager";

export const metadata: Metadata = { title: "Kelola Kegiatan - Master Data" };

export default async function ActivitiesPage() {
  await assertCanManageMasterData();
  const rawActivities = await getActivitiesWithSessions();

  // Convert decimal fields to numbers to prevent serialization errors
  const activities = rawActivities.map((act) => ({
    id: act.id,
    code: act.code,
    name: act.name,
    order: act.order,
    isImportOnly: act.isImportOnly,
    sessions: act.sessions.map((sess) => ({
      id: sess.id,
      code: sess.code,
      name: sess.name,
      mode: sess.mode,
      quorumThresholdPct: decimalToNumber(sess.quorumThresholdPct),
      scheduledAt: sess.scheduledAt,
    })),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Master Data</h2>
        <p className="text-sm text-muted-foreground">
          Kelola alur kegiatan pengembangan dan sesi pertemuan.
        </p>
      </div>

      <MasterDataSectionNav />

      <ActivitiesManager initialActivities={activities} />
    </div>
  );
}
