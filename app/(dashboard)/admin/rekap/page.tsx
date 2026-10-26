import type { Metadata } from "next";
import Link from "next/link";
import { Download, Info } from "lucide-react";
import { assertRole } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { getRecapData, getRecapSettings, buildRecapView } from "@/lib/scoring/recap";
import { BesarPieGrid, PredicatePieGrid } from "@/components/admin/recap-pies";
import { RecapCharts } from "@/components/admin/recap-charts";
import { RecapRefreshButton } from "@/components/admin/recap-refresh-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Rekap Nilai - Admin" };

const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(1));

export default async function RekapPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  await assertRole(Role.ADMIN);
  const { dept } = await searchParams;

  const [data, recapSettings] = await Promise.all([getRecapData(), getRecapSettings()]);
  const { meta } = data;
  const { departments, activeDept, stats, pies, besar, explanations } = buildRecapView(data, recapSettings, dept ?? null);
  const exportHref = `/api/export/rekap${activeDept ? `?dept=${encodeURIComponent(activeDept.code)}` : ""}`;

  const tabs = [{ code: null as string | null, label: "Semua" }, ...departments.map((d) => ({ code: d.code, label: d.name }))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Rekap Nilai Maba</h2>
          <p className="text-sm text-muted-foreground">
            Sebaran nilai keseluruhan dan per departemen. Dihitung {new Date(meta.generatedAt).toLocaleString("id-ID")} (cache 10 menit).
          </p>
        </div>
        <div className="flex gap-2">
          <RecapRefreshButton />
          <Button size="sm" nativeButton={false} render={<a href={exportHref} download />}>
            <Download className="size-4" />
            Unduh Excel {activeDept ? activeDept.name : "Semua"}
          </Button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b pb-px" aria-label="Departemen">
        {tabs.map((t) => {
          const active = (t.code ?? null) === (activeDept?.code ?? null);
          return (
            <Link
              key={t.code ?? "ALL"}
              href={t.code ? `/admin/rekap?dept=${encodeURIComponent(t.code)}` : "/admin/rekap"}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
                active ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Jumlah maba" value={String(stats.total)} hint={`${stats.eligible} layak diagregasi`} />
        <StatTile
          label="Tidak layak diagregasi"
          value={String(stats.ineligible)}
          hint={`Temu FTEIC ${stats.ineligibleTemu} · Kegiatan Besar ${stats.ineligibleBesar}`}
          tone={stats.ineligible > 0 ? "warn" : undefined}
        />
        <StatTile label="Rata-rata Nilai Personal" value={fmt(stats.personal.mean)} hint={`median ${fmt(stats.personal.median)} · SD ${fmt(stats.personal.std)}`} />
        <StatTile label="Rata-rata Nilai Keahlian" value={fmt(stats.skill.mean)} hint={`median ${fmt(stats.skill.median)} · SD ${fmt(stats.skill.std)}`} />
      </div>

      <PredicatePieGrid
        title="Pemetaan Sub-Nilai Personal"
        description={explanations.predicatePies}
        pies={pies.filter((p) => p.group === "Sub-Nilai Personal")}
      />
      <PredicatePieGrid
        title="Pemetaan Nilai Keahlian per Kategori"
        description={explanations.predicatePies}
        pies={pies.filter((p) => p.group === "Keahlian")}
      />
      <BesarPieGrid description={explanations.besarPies} sessions={besar} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Info className="size-4 text-primary" />
            Dari mana nilai ini berasal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
            {explanations.overview.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <RecapCharts stats={stats} departments={activeDept ? null : departments} explanations={explanations} />

      {!activeDept ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ringkasan per Departemen</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="p-2">Departemen</th>
                  <th className="p-2 text-right">Maba</th>
                  <th className="p-2 text-right">Layak</th>
                  <th className="p-2 text-right">Tidak layak</th>
                  <th className="p-2 text-right">Rata-rata Personal</th>
                  <th className="p-2 text-right">Rata-rata Keahlian</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {departments.map((d) => (
                  <tr key={d.code}>
                    <td className="p-2">
                      <Link href={`/admin/rekap?dept=${encodeURIComponent(d.code)}`} className="font-medium hover:underline">
                        {d.name}
                      </Link>
                    </td>
                    <td className="p-2 text-right tabular-nums">{d.total}</td>
                    <td className="p-2 text-right tabular-nums">{d.eligible}</td>
                    <td className="p-2 text-right tabular-nums">{d.total - d.eligible}</td>
                    <td className="p-2 text-right tabular-nums">{fmt(d.personalMean)}</td>
                    <td className="p-2 text-right tabular-nums">{fmt(d.skillMean)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "warn" }) {
  return (
    <div className={cn("rounded-xl border bg-card p-3", tone === "warn" && "border-destructive/40")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", tone === "warn" && "text-destructive")}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
