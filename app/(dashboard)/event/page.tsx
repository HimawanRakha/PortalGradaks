import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Trophy, MapPin, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Role } from "@/app/generated/prisma/enums";

export const metadata: Metadata = { title: "Beranda Event" };

export default async function EventHomePage() {
  await assertRole(Role.ADMIN, Role.EVENT);

  const [regionCount, unitCount, regionsScored, unitsWithThroneWinner] = await Promise.all([
    prisma.region.count(),
    prisma.unit.count(),
    prisma.regionEventScore.findMany({ select: { regionId: true }, distinct: ["regionId"] }).then((r) => r.length),
    prisma.unitEventScore.count({
      where: { parameter: { material: { code: "THRONE_BATTLE" } }, value: { gt: 0 } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Beranda Panitia Event</h2>
        <p className="text-sm text-muted-foreground">
          Menilai Terkompak per region & Winner Throne Battle per unit untuk kompetisi Inclenation.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Region" value={regionCount} icon={MapPin} />
        <StatCard label="Total Unit" value={unitCount} icon={Users} />
        <StatCard label="Region Sudah Dinilai" value={`${regionsScored}/${regionCount}`} icon={Trophy} />
        <StatCard label="Unit Menang Throne Battle" value={unitsWithThroneWinner} icon={Trophy} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Penilaian Event</CardTitle>
            <CardDescription>Isi Terkompak per region dan tandai Winner Throne Battle per unit.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/event/scoring" />}>
              <ClipboardList className="size-4" />
              Buka Penilaian
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leaderboard</CardTitle>
            <CardDescription>Ranking Terbaik, Terdisiplin, dan Terkompak lintas region.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/event/leaderboard" />}>
              <Trophy className="size-4" />
              Lihat Leaderboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
