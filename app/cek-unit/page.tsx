import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, Clock, TriangleAlert, XCircle } from "lucide-react";
import { getUnitChecklist } from "@/lib/scoring/unit-checklist";
import { UnitReminderButton } from "@/components/public/unit-reminder-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Cek Status Unit" };

// Public, unauthenticated lookup for the Ketua Unit maba (see proxy.ts's
// "/cek-unit" exemption + dedicated status-unit domain). Shows ONLY
// completeness counts per activity — never any maba's name or score — so
// knowing a unit code reveals nothing private.
export default async function CekUnitPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const { unit: rawUnit } = await searchParams;
  const unitCode = rawUnit?.trim();
  const data = unitCode ? await getUnitChecklist(unitCode) : null;

  const incompleteCount = data?.incompleteItems.length ?? 0;

  return (
    <div className="relative min-h-svh bg-muted/40 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/BEMFTEIC.png" alt="Logo BEM FTEIC" className="size-16 object-contain" />
          <h1 className="text-lg font-semibold">Cek Status Kelengkapan Unit</h1>
          <p className="text-sm text-muted-foreground">GRADAKS 2026 — PSDM BEM FTEIC</p>
        </div>

        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Masukkan Kode Unit</CardTitle>
            <CardDescription>Format Region-Unit, contoh: R01-U03.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/cek-unit" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="unit">Kode Unit</Label>
                <Input
                  id="unit"
                  name="unit"
                  placeholder="Contoh: R01-U03"
                  defaultValue={unitCode ?? ""}
                  required
                  autoFocus={!data}
                  autoCapitalize="characters"
                />
              </div>
              <Button type="submit" className="h-11 w-full">
                Cek Status Unit
              </Button>
            </form>
          </CardContent>
        </Card>

        {unitCode && !data ? (
          <Alert variant="destructive" className="w-full max-w-sm">
            <TriangleAlert className="size-4" />
            <AlertTitle>Kode unit tidak ditemukan</AlertTitle>
            <AlertDescription>Periksa kembali kode Region-Unit Anda (contoh: R01-U03), atau tanyakan ke mentor.</AlertDescription>
          </Alert>
        ) : null}

        {data ? (
          <div className="w-full space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold">{data.unitName}</h2>
              <p className="text-sm text-muted-foreground">
                {data.unitCode} · {data.regionName} · Mentor: {data.mentorName ?? "belum ditentukan"} · {data.mabaCount} Maba
              </p>
            </div>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Progres Total Unit</span>
                  <span className="text-2xl font-semibold tabular-nums">{data.pct}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${data.pct >= 100 ? "bg-emerald-500" : data.pct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(data.pct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Dihitung dari kegiatan yang sudah berjalan. Data diperbarui otomatis setiap kali halaman dibuka.
                </p>
              </CardContent>
            </Card>

            {data.totalCount > 0 && incompleteCount === 0 ? (
              <Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                <AlertTitle className="font-semibold">Unit Anda sudah aman!</AlertTitle>
                <AlertDescription className="text-xs text-emerald-700/90 dark:text-emerald-400/90">
                  Semua presensi dan penilaian dari kegiatan yang sudah berjalan telah diisi Mentor.
                </AlertDescription>
              </Alert>
            ) : incompleteCount > 0 ? (
              <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <TriangleAlert className="size-4" />
                <AlertTitle className="font-semibold">Ada {incompleteCount} penilaian yang belum lengkap diisi Mentor</AlertTitle>
                <AlertDescription className="text-xs text-amber-700/90 dark:text-amber-400/90">
                  Salin pesan pengingat di bawah dan kirimkan ke grup WA unit atau ke Mentor Anda.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CircleDashed className="size-4" />
                <AlertTitle className="font-semibold">Belum ada kegiatan yang berjalan</AlertTitle>
                <AlertDescription className="text-xs">Status akan muncul setelah kegiatan pertama dimulai.</AlertDescription>
              </Alert>
            )}

            {incompleteCount > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Chat Reminder untuk Mentor</CardTitle>
                  <CardDescription>Pesan sopan otomatis — tinggal salin lalu tempel di grup WA unit.</CardDescription>
                </CardHeader>
                <CardContent>
                  <UnitReminderButton
                    mentorName={data.mentorName}
                    unitCode={data.unitCode}
                    unitName={data.unitName}
                    incompleteItems={data.incompleteItems}
                    overallPct={data.pct}
                  />
                </CardContent>
              </Card>
            ) : null}

            {data.activities.map((act) => {
              const actDone = act.items.every((i) => i.isComplete);
              return (
                <Card key={act.code}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span>{act.name}</span>
                      {!act.started ? (
                        <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                          <Clock className="size-3.5" /> Belum dimulai
                        </span>
                      ) : actDone ? (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Lengkap</span>
                      ) : (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">Belum lengkap</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {act.items.map((it) => (
                        <li key={it.key} className="flex items-start gap-3 py-2.5 text-sm">
                          {!act.started ? (
                            <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          ) : it.isComplete ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{it.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {!act.started
                                ? "Belum dimulai"
                                : it.isComplete
                                  ? "LENGKAP"
                                  : it.doneCount === 0
                                    ? "BELUM DIISI MENTOR"
                                    : "SEBAGIAN TERISI"}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {Math.min(it.doneCount, it.totalCount)}/{it.totalCount} {it.unitLabel}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
