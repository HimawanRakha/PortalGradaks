import type { Metadata } from "next";
import { assertRole } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { Role, FlagStatus } from "@/app/generated/prisma/enums";
import { EscalationPanel } from "@/components/kr/escalation-panel";

export const metadata: Metadata = { title: "Papan Eskalasi - Kepala Region" };

export default async function EscalationPage() {
  const user = await assertRole(Role.KEPALA_REGION, Role.ADMIN);
  if (!user.regionId) {
    throw new Error("Akun Anda belum ditautkan ke wilayah region mana pun.");
  }

  // Fetch open and resolved flags in this region
  const [openFlags, resolvedFlags] = await Promise.all([
    prisma.flag.findMany({
      where: {
        unit: { regionId: user.regionId },
        status: FlagStatus.OPEN,
      },
      include: {
        student: { select: { name: true, nrp: true } },
        unit: { select: { code: true, name: true } },
        raisedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.flag.findMany({
      where: {
        unit: { regionId: user.regionId },
        status: FlagStatus.RESOLVED,
      },
      include: {
        student: { select: { name: true, nrp: true } },
        unit: { select: { code: true, name: true } },
        raisedBy: { select: { name: true } },
        resolvedBy: { select: { name: true } },
      },
      orderBy: { resolvedAt: "desc" },
      take: 50,
    }),
  ]);

  const mappedOpenFlags = openFlags.map((flag) => ({
    id: flag.id,
    message: flag.message,
    status: flag.status,
    createdAt: flag.createdAt,
    student: flag.student,
    unit: flag.unit ? { code: flag.unit.code, name: flag.unit.name } : { code: "-", name: "-" },
    raisedByUser: { name: flag.raisedBy.name },
  }));

  const mappedResolvedFlags = resolvedFlags.map((flag) => ({
    id: flag.id,
    message: flag.message,
    status: flag.status,
    createdAt: flag.createdAt,
    student: flag.student,
    unit: flag.unit ? { code: flag.unit.code, name: flag.unit.name } : { code: "-", name: "-" },
    raisedByUser: { name: flag.raisedBy.name },
    resolvedByUser: flag.resolvedBy ? { name: flag.resolvedBy.name } : null,
    resolvedAt: flag.resolvedAt,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Papan Eskalasi Region</h2>
        <p className="text-sm text-muted-foreground">
          Selesaikan kendala dan laporan isu mahasiswa baru yang dikirimkan oleh para mentor di region Anda.
        </p>
      </div>

      <EscalationPanel openFlags={mappedOpenFlags} resolvedFlags={mappedResolvedFlags} />
    </div>
  );
}
