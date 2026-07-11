import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AutoSubmitSelect } from "@/components/scoring/auto-submit-select";
import { DamenVerifyCard } from "@/components/scoring/damen-verify-card";
import { Card, CardContent } from "@/components/ui/card";
import { VerificationLayer } from "@/app/generated/prisma/enums";

export const metadata: Metadata = { title: "Verifikasi Akhir" };

const FILTERS = [
  { value: "PENDING", label: "Belum diverifikasi" },
  { value: "VERIFIED", label: "Terverifikasi" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "ALL", label: "Semua" },
];

export default async function DamenVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "PENDING" } = await searchParams;

  const students = await prisma.student.findMany({
    where: { active: true },
    include: {
      unit: { select: { name: true } },
      verifications: { where: { layer: VerificationLayer.DAMEN } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  const withStatus = students.map((s) => ({
    student: s,
    status: (s.verifications[0]?.status ?? "PENDING") as "PENDING" | "VERIFIED" | "REJECTED",
  }));

  const filtered = filter === "ALL" ? withStatus : withStatus.filter((s) => s.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Verifikasi Akhir — Lapis Damen</h2>
          <p className="text-sm text-muted-foreground">
            Verifikasi kelengkapan data maba sebelum lanjut ke pemeriksaan PSDM.
          </p>
        </div>
        <form action="/damen/verification">
          <AutoSubmitSelect name="filter" defaultValue={filter} options={FILTERS} />
        </form>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada maba untuk filter ini.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(({ student, status }) => (
            <DamenVerifyCard
              key={student.id}
              student={{ id: student.id, name: student.name, nrp: student.nrp, unitName: student.unit.name }}
              currentStatus={status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
