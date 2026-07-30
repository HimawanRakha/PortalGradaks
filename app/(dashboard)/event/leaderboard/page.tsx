import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { getCurrentUser, ForbiddenError } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { getUnitLeaderboard, getRegionLeaderboard, type UnitEventBoardRow, type RegionEventBoardRow } from "@/lib/scoring/event-calculate";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Leaderboard Event Inclenation" };

const LEADERBOARD_ROLES: Role[] = [Role.ADMIN, Role.EVENT, Role.KEPALA_REGION];

function RankBadge({ rank }: { rank: number }) {
  return <Badge variant={rank <= 3 ? "default" : "secondary"}>#{rank}</Badge>;
}

/** Legend so "why is this the total" is never ambiguous — spells out every column that feeds the score. */
function FormulaAlert({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Alert className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 rounded-xl">
      <Info className="size-4" />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription className="text-xs mt-1 text-blue-700/90 dark:text-blue-400/90">{children}</AlertDescription>
    </Alert>
  );
}

function UnitTable({ rows, primaryScoreLabel, primaryScore }: { rows: UnitEventBoardRow[]; primaryScoreLabel: string; primaryScore: (row: UnitEventBoardRow) => number }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada unit untuk ditampilkan.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[900px] text-left text-xs border-collapse">
        <thead>
          <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
            <th className="p-3">#</th>
            <th className="p-3">Unit</th>
            <th className="p-3">Region</th>
            <th className="p-3 text-right">Teraktif</th>
            <th className="p-3 text-right">Terdisiplin</th>
            <th className="p-3 text-right">Pelanggaran</th>
            <th className="p-3 text-right">Throne</th>
            <th className="p-3 text-right">Terkompak Region</th>
            <th className="p-3 text-right">Rata² Materi</th>
            <th className="p-3 text-right">{primaryScoreLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={row.unitId} className="hover:bg-muted/30">
              <td className="p-3">
                <RankBadge rank={i + 1} />
              </td>
              <td className="p-3 font-semibold">
                <span className="font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px] mr-1.5 border">{row.unitCode}</span>
                {row.unitName}
              </td>
              <td className="p-3 text-muted-foreground">{row.regionName}</td>
              <td className="p-3 text-right tabular-nums">{row.teraktif}</td>
              <td className="p-3 text-right tabular-nums">{row.terdisiplinRaw}</td>
              <td className="p-3 text-right tabular-nums text-destructive">{row.pelanggaranTotal > 0 ? `-${row.pelanggaranTotal}` : 0}</td>
              <td className="p-3 text-right">{row.throneBattleWinner ? <Badge>+35</Badge> : <span className="text-muted-foreground">-</span>}</td>
              <td className="p-3 text-right tabular-nums">{row.regionTerkompakScore}</td>
              <td className="p-3 text-right tabular-nums">{row.materialAvg ?? "-"}</td>
              <td className="p-3 text-right text-sm font-bold tabular-nums">{primaryScore(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TerdisiplinTable({ rows }: { rows: UnitEventBoardRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada unit untuk ditampilkan.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
            <th className="p-3">#</th>
            <th className="p-3">Unit</th>
            <th className="p-3">Region</th>
            <th className="p-3 text-right">Terdisiplin</th>
            <th className="p-3 text-right">Pelanggaran</th>
            <th className="p-3 text-right">Total Terdisiplin</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={row.unitId} className="hover:bg-muted/30">
              <td className="p-3">
                <RankBadge rank={i + 1} />
              </td>
              <td className="p-3 font-semibold">
                <span className="font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px] mr-1.5 border">{row.unitCode}</span>
                {row.unitName}
              </td>
              <td className="p-3 text-muted-foreground">{row.regionName}</td>
              <td className="p-3 text-right tabular-nums">{row.terdisiplinRaw}</td>
              <td className="p-3 text-right tabular-nums text-destructive">{row.pelanggaranTotal > 0 ? `-${row.pelanggaranTotal}` : 0}</td>
              <td className="p-3 text-right text-sm font-bold tabular-nums">{row.terdisiplinScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TerkompakUnitTable({ rows }: { rows: UnitEventBoardRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada unit untuk ditampilkan.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
            <th className="p-3">#</th>
            <th className="p-3">Unit</th>
            <th className="p-3">Region</th>
            <th className="p-3 text-right">Nilai Teraktif</th>
            <th className="p-3 text-right">Terkompak Region</th>
            <th className="p-3 text-right">Total Terkompak</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={row.unitId} className="hover:bg-muted/30">
              <td className="p-3">
                <RankBadge rank={i + 1} />
              </td>
              <td className="p-3 font-semibold">
                <span className="font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px] mr-1.5 border">{row.unitCode}</span>
                {row.unitName}
              </td>
              <td className="p-3 text-muted-foreground">{row.regionName}</td>
              <td className="p-3 text-right tabular-nums">{row.teraktif}</td>
              <td className="p-3 text-right tabular-nums">{row.regionTerkompakScore}</td>
              <td className="p-3 text-right text-sm font-bold tabular-nums">{row.terkompakScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegionTable({ rows }: { rows: RegionEventBoardRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Belum ada region untuk ditampilkan.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
            <th className="p-3">#</th>
            <th className="p-3">Region</th>
            <th className="p-3">Kriteria Terpenuhi</th>
            <th className="p-3 text-right">Nilai Mentah</th>
            <th className="p-3 text-right">Nilai Terkompak</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={row.regionId} className="hover:bg-muted/30">
              <td className="p-3">
                <RankBadge rank={i + 1} />
              </td>
              <td className="p-3 font-semibold">
                <span className="font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px] mr-1.5 border">{row.regionCode}</span>
                {row.regionName}
              </td>
              <td className="p-3 text-muted-foreground">
                {row.terkompakRaw}/{row.terkompakCriteriaCount}
              </td>
              <td className="p-3 text-right tabular-nums">{row.terkompakRaw}</td>
              <td className="p-3 text-right text-sm font-bold tabular-nums">{row.terkompakScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function EventLeaderboardPage() {
  const user = await getCurrentUser();
  if (!LEADERBOARD_ROLES.includes(user.role)) throw new ForbiddenError();

  const [allUnits, allRegions] = await Promise.all([getUnitLeaderboard(), getRegionLeaderboard()]);

  // Kepala Region only ever sees their own region's slice — same scope
  // boundary as the rest of this app (recap/calibration), never a
  // cross-region comparison.
  const isRegionScoped = user.role === Role.KEPALA_REGION;
  const units = isRegionScoped ? allUnits.filter((u) => u.regionId === user.regionId) : allUnits;
  const regions = isRegionScoped ? allRegions.filter((r) => r.regionId === user.regionId) : allRegions;

  const terdisiplinSorted = [...units].sort((a, b) => b.terdisiplinScore - a.terdisiplinScore);
  const terkompakSorted = [...units].sort((a, b) => b.terkompakScore - a.terkompakScore);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Leaderboard Event Inclenation</h2>
        <p className="text-sm text-muted-foreground">
          {isRegionScoped ? "Ranking unit di region Anda untuk Terbaik, Terdisiplin & Terkompak." : "Ranking lintas semua region — bukan pemenang otomatis, panitia yang memutuskan juara dari ranking ini."}
        </p>
      </div>

      <Tabs defaultValue="terbaik">
        <TabsList>
          <TabsTrigger value="terbaik">Terbaik</TabsTrigger>
          <TabsTrigger value="terdisiplin">Terdisiplin</TabsTrigger>
          <TabsTrigger value="terkompak">Terkompak</TabsTrigger>
        </TabsList>

        <TabsContent value="terbaik" className="mt-3 space-y-3">
          <FormulaAlert title="Cara menghitung Total Terbaik">
            Total Terbaik = (Teraktif × 2) + Terdisiplin (jumlah 6 kriteria Hari 1 &amp; Hari 2) + Bonus Throne Battle (+35 jika unit ini menang) − Pelanggaran (Telat dikali 2 jika &gt;5 orang, Pelanggaran Lainnya tidak ikut dihitung
            otomatis) + Nilai Terkompak dari region unit ini + Rata-rata nilai materi Inclenation (KWYA, BMB, Wawasan Teknologi, Wawasan FTEIC) seluruh maba di unit tsb. Kolom di bawah persis komponen-komponen ini — total di kolom
            paling kanan adalah jumlahnya.
          </FormulaAlert>
          <Card>
            <CardContent className="p-0">
              <UnitTable rows={units} primaryScoreLabel="Total Terbaik" primaryScore={(r) => r.terbaikScore} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="terdisiplin" className="mt-3 space-y-3">
          <FormulaAlert title="Cara menghitung Total Terdisiplin">
            Total Terdisiplin = Terdisiplin (jumlah 6 kriteria: Ketaatan Peraturan, Ketepatan Jadwal, Paling Cepat Siap — masing-masing Hari 1 &amp; Hari 2) − Pelanggaran (Telat dikali 2 jika &gt;5 orang; Pelanggaran Lainnya tidak ikut
            dihitung otomatis). Teraktif, Throne Battle, Terkompak, dan nilai materi TIDAK ikut memengaruhi kategori ini.
          </FormulaAlert>
          <Card>
            <CardContent className="p-0">
              <TerdisiplinTable rows={terdisiplinSorted} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="terkompak" className="mt-3 space-y-4">
          <FormulaAlert title="Cara menghitung Total Terkompak Unit">
            Total Terkompak = Nilai Teraktif (Unit) + Nilai Terkompak Region (yang dihitung per region dari 5 kriteria Panitia Event: Kerjasama Tim, Semua Anggota Hafal Jargon, Kompak Saat Jargon, Jargon Bagus, Warna Dresscode Mirip — jika semua 5 kriteria terpenuhi, nilai mentah dikali 2).
          </FormulaAlert>
          <Card>
            <CardContent className="p-0">
              <TerkompakUnitTable rows={terkompakSorted} />
            </CardContent>
          </Card>

          <div className="pt-2 space-y-2">
            <h3 className="text-sm font-semibold">Rekap Nilai Terkompak per Region</h3>
            <Card>
              <CardContent className="p-0">
                <RegionTable rows={regions} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
