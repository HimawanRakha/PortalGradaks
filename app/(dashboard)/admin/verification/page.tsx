import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, VerificationLayer, VerificationStatus } from "@/app/generated/prisma/enums";
import { PsdmVerifyCard } from "@/components/admin/psdm-verify-card";
import { AutoSubmitSelect } from "@/components/scoring/auto-submit-select";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Pemeriksaan Akhir Tiga Lapis - Admin" };

const FILTERS = [
  { value: "PENDING", label: "Belum diverifikasi PSDM" },
  { value: "VERIFIED", label: "Terverifikasi PSDM" },
  { value: "REJECTED", label: "Ditolak PSDM" },
  { value: "ALL", label: "Semua" },
];

export default async function AdminVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await assertRole(Role.ADMIN);
  const { filter = "PENDING" } = await searchParams;

  // 1. Fetch Damen verification toggle setting
  const damenEnabledSetting = await prisma.setting.findUnique({
    where: { key: "verification.damenEnabled" },
  });
  const damenEnabled = damenEnabledSetting ? !!damenEnabledSetting.value : false;

  // 2. Fetch students and their verification layers
  const students = await prisma.student.findMany({
    where: { active: true },
    include: {
      unit: { select: { name: true } },
      verifications: true,
      logbookEntries: {
        select: { status: true },
      },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  const studentVerifyItems = students.map((s) => {
    // Check Mentor Layer status based on unverified logbooks
    const unverifiedLogbookCount = s.logbookEntries.filter(
      (e) => e.status === "BELUM_DIVERIFIKASI"
    ).length;
    const mentorStatus = (unverifiedLogbookCount > 0 ? "PENDING" : "VERIFIED") as VerificationStatus;

    // Damen status
    const damenVerify = s.verifications.find((v) => v.layer === VerificationLayer.DAMEN);
    const damenStatus = (damenVerify?.status ?? "PENDING") as "PENDING" | "VERIFIED" | "REJECTED";

    // PSDM status
    const psdmVerify = s.verifications.find((v) => v.layer === VerificationLayer.PSDM);
    const psdmStatus = (psdmVerify?.status ?? "PENDING") as "PENDING" | "VERIFIED" | "REJECTED";

    return {
      id: s.id,
      name: s.name,
      nrp: s.nrp,
      unitName: s.unit.name,
      mentorStatus,
      damenStatus,
      psdmStatus,
      damenEnabled,
    };
  });

  const filtered = filter === "ALL" 
    ? studentVerifyItems 
    : studentVerifyItems.filter((s) => s.psdmStatus === filter);

  return (
    <div className="space-y-6 text-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-semibold">Pemeriksaan & Verifikasi Akhir Tiga Lapis</h2>
          <p className="text-sm text-muted-foreground font-medium">
            Verifikasi kelayakan maba oleh PSDM setelah melalui layer Mentor dan Damen.
          </p>
        </div>
        <form action="/admin/verification" method="GET">
          <AutoSubmitSelect name="filter" defaultValue={filter} options={FILTERS} />
        </form>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground font-medium">
            Tidak ada data maba untuk filter ini.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <PsdmVerifyCard
              key={item.id}
              student={item}
              currentStatus={item.psdmStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
