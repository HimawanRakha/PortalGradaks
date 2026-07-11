import type { Metadata } from "next";
import { assertCanManageMasterData } from "@/lib/auth/dal";
import { getSessionsForSchedule, decimalToNumber } from "@/lib/data/master-data";
import { MasterDataSectionNav } from "@/components/master-data/section-nav";
import { ScheduleManager } from "@/components/master-data/schedule-manager";

export const metadata: Metadata = { title: "Kelola Jadwal - Master Data" };

export default async function SchedulePage() {
  await assertCanManageMasterData();
  const rawSessions = await getSessionsForSchedule();

  const sessions = rawSessions.map((sess) => ({
    id: sess.id,
    code: sess.code,
    name: sess.name,
    mode: sess.mode,
    scheduledAt: sess.scheduledAt,
    quorumThresholdPct: decimalToNumber(sess.quorumThresholdPct),
    activity: {
      id: sess.activity.id,
      code: sess.activity.code,
      name: sess.activity.name,
    },
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Master Data</h2>
        <p className="text-sm text-muted-foreground">
          Kelola jadwal tanggal pelaksanaan sesi kegiatan dan kuorum kehadiran minimum H-7.
        </p>
      </div>

      <MasterDataSectionNav />

      <ScheduleManager initialSessions={sessions} />
    </div>
  );
}
