import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireMentorUnit } from "@/lib/data/mentor";
import { prisma } from "@/lib/prisma";
import { AutoSubmitSelect } from "@/components/scoring/auto-submit-select";
import { LogbookEntryCard } from "@/components/scoring/logbook-entry-card";
import { Card, CardContent } from "@/components/ui/card";
import { LogbookStatus } from "@/app/generated/prisma/enums";

export const metadata: Metadata = { title: "Verifikasi Logbook" };

const FILTERS = [
  { value: "PENDING", label: "Belum diverifikasi" },
  { value: "LENGKAP", label: "Lengkap" },
  { value: "PERLU_REVISI", label: "Perlu revisi" },
  { value: "ALL", label: "Semua" },
];

export default async function MentorLogbookPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "PENDING" } = await searchParams;
  const user = await getCurrentUser();
  const unit = await requireMentorUnit(user);
  const studentIds = unit.students.map((s) => s.id);

  const statusFilter =
    filter === "ALL"
      ? undefined
      : filter === "PENDING"
        ? LogbookStatus.BELUM_DIVERIFIKASI
        : (filter as LogbookStatus);

  const entries = await prisma.logbookEntry.findMany({
    where: { studentId: { in: studentIds }, ...(statusFilter ? { status: statusFilter } : {}) },
    include: { student: { select: { name: true, nrp: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Verifikasi Logbook</h2>
          <p className="text-sm text-muted-foreground">Konten diimpor dari GForm — Anda hanya memverifikasi, bukan mengetik ulang.</p>
        </div>
        <form action="/mentor/logbook">
          <AutoSubmitSelect name="filter" defaultValue={filter} options={FILTERS} />
        </form>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada entri logbook untuk filter ini.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {entries.map((entry) => (
            <LogbookEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
