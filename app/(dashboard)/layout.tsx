import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";

async function getUnitLabel(unitId: string | null, regionId: string | null) {
  if (unitId) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { name: true, region: { select: { name: true } } },
    });
    return unit ? `${unit.name} · ${unit.region.name}` : undefined;
  }
  if (regionId) {
    const region = await prisma.region.findUnique({ where: { id: regionId }, select: { name: true } });
    return region?.name;
  }
  return undefined;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unitLabel = await getUnitLabel(user.unitId, user.regionId);

  return (
    <div className="flex min-h-svh">
      <Sidebar role={user.role} unitLabel={unitLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header role={user.role} name={user.name ?? user.nrp} nrp={user.nrp} />
        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</div>
        </main>
        <BottomNav role={user.role} />
      </div>
    </div>
  );
}
