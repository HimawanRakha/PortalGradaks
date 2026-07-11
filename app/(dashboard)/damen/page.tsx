import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VerificationLayer, VerificationStatus } from "@/app/generated/prisma/enums";

export const metadata: Metadata = { title: "Beranda Damen" };

export default async function DamenHomePage() {
  const [totalStudents, verified, rejected] = await Promise.all([
    prisma.student.count({ where: { active: true } }),
    prisma.verification.count({ where: { layer: VerificationLayer.DAMEN, status: VerificationStatus.VERIFIED } }),
    prisma.verification.count({ where: { layer: VerificationLayer.DAMEN, status: VerificationStatus.REJECTED } }),
  ]);
  const pending = totalStudents - verified - rejected;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Beranda Damen</h2>
        <p className="text-sm text-muted-foreground">
          Verifikator lapis kedua pada pemeriksaan akhir sebelum kompilasi raport.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Menunggu Verifikasi" value={Math.max(pending, 0)} tone={pending > 0 ? "warning" : "success"} />
        <StatCard label="Terverifikasi" value={verified} tone="success" />
        <StatCard label="Ditolak" value={rejected} tone={rejected > 0 ? "danger" : "default"} />
      </div>

      <Card>
        <CardContent className="py-5">
          <Button render={<Link href="/damen/verification" />}>
            <CheckSquare className="size-4" />
            Buka Verifikasi Akhir
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
