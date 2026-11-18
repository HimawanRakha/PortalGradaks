import type { Metadata } from "next";
import { FileDown, Lock, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeScores, type ComputedScores } from "@/lib/scoring/calculate";
import { StudentRaportView, studentRaportInclude } from "@/components/scoring/student-raport-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { isRaportPublicCheckEnabled } from "@/lib/scoring/raport-public";

export const metadata: Metadata = { title: "Cek Raport Maba" };

// Per-request only: the page depends on a Settings toggle and live data, never on a build-time snapshot.
export const dynamic = "force-dynamic";

// Public, unauthenticated lookup (see proxy.ts's "/cek-raport" exemption) — a
// maba proves nothing beyond knowing their own NRP. Deliberately reuses the
// same live computeScores() the mentor view uses rather than only reading
// RaportSnapshot, so progress is visible all program long, not just after
// PSDM finalization; the snapshot (once it exists) only adds the "official,
// frozen" banner on top.
export default async function CekRaportPage({ searchParams }: { searchParams: Promise<{ nrp?: string }> }) {
  // Closed by PSDM from Master Data > Pengaturan (e.g. while finalizing): no lookup at all.
  if (!(await isRaportPublicCheckEnabled())) {
    return (
      <div className="relative min-h-svh bg-muted/40 p-4">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <img src="/BEMFTEIC.png" alt="Logo BEM FTEIC" className="size-16 object-contain" />
            <h1 className="text-lg font-semibold">Cek Raport Maba</h1>
            <p className="text-sm text-muted-foreground">GRADAKS 2026 — PSDM BEM FTEIC</p>
          </div>
          <Alert className="w-full max-w-sm">
            <Lock className="size-4" />
            <AlertTitle className="font-semibold">Cek Raport dinonaktifkan sementara</AlertTitle>
            <AlertDescription className="text-xs">
              PSDM BEM FTEIC sedang melakukan finalisasi raport. Halaman ini akan dibuka kembali setelah raport final siap.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { nrp: rawNrp } = await searchParams;
  const nrp = rawNrp?.trim();

  const student = nrp
    ? await prisma.student.findFirst({
        where: { nrp: { equals: nrp, mode: "insensitive" } },
        include: {
          unit: { include: { region: true } },
          department: true,
          raportSnapshot: true,
          ...studentRaportInclude,
        },
      })
    : null;

  // Once finalized, show the frozen snapshot values (the official result) rather than a live recomputation.
  const frozen = student?.raportSnapshot?.breakdown as unknown as ComputedScores | undefined;
  const computed = student ? (frozen?.personal?.components && frozen.attendance ? frozen : await computeScores(student.id)) : null;

  return (
    <div className="relative min-h-svh bg-muted/40 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/BEMFTEIC.png" alt="Logo BEM FTEIC" className="size-16 object-contain" />
          <h1 className="text-lg font-semibold">Cek Raport Maba</h1>
          <p className="text-sm text-muted-foreground">GRADAKS 2026 — PSDM BEM FTEIC</p>
        </div>

        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Masukkan NRP</CardTitle>
            <CardDescription>Hasil penilaian Anda akan tampil di bawah setelah NRP dikirim.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/cek-raport" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nrp">NRP</Label>
                <Input id="nrp" name="nrp" placeholder="Contoh: M2601001" defaultValue={nrp ?? ""} required autoFocus={!student} />
              </div>
              <Button type="submit" className="w-full h-11">
                Cek Raport
              </Button>
            </form>
          </CardContent>
        </Card>

        {nrp && !student ? (
          <Alert variant="destructive" className="w-full max-w-sm">
            <TriangleAlert className="size-4" />
            <AlertTitle>NRP tidak ditemukan</AlertTitle>
            <AlertDescription>Periksa kembali NRP Anda, atau hubungi mentor jika masalah berlanjut.</AlertDescription>
          </Alert>
        ) : null}

        {student && computed ? (
          <div className="w-full min-w-0 space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold">{student.name}</h2>
              <p className="text-sm text-muted-foreground">
                {student.nrp} · {student.unit.name} · {student.unit.region.name}
                {student.department ? ` · ${student.department.name}` : ""}
              </p>
            </div>

            {student.raportSnapshot?.dataInsufficient ? (
              <Alert className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                <TriangleAlert className="size-4" />
                <AlertTitle className="font-semibold">{student.raportSnapshot.recommendation}</AlertTitle>
                <AlertDescription className="text-xs mt-1 text-amber-700/90 dark:text-amber-400/90">
                  {student.raportSnapshot.description}
                </AlertDescription>
              </Alert>
            ) : student.raportSnapshot ? (
              <p className="text-center text-sm font-bold text-foreground">
                Nilai Anda sudah difinalisasi. Silakan unduh raport Anda.
              </p>
            ) : (
              <Alert className="w-full">
                <AlertTitle className="text-sm font-semibold">Belum difinalisasi</AlertTitle>
                <AlertDescription className="text-xs">
                  Nilai di bawah ini adalah estimasi berjalan, bukan nilai resmi akhir. Nilai resmi akan muncul di sini
                  setelah PSDM melakukan finalisasi raport.
                </AlertDescription>
              </Alert>
            )}

            {/* Deliberately not the primary-button look: this is the one action
                maba should spot instantly, so it gets its own solid red + PDF icon.
                Locked until this maba's raport is finalized (the PDF route
                enforces the same rule server-side). */}
            {student.raportSnapshot ? (
              <Button
                className="h-auto w-full gap-3 border-0 bg-red-600 py-3 text-white hover:bg-red-700"
                nativeButton={false}
                render={<a href={`/cek-raport/pdf?nrp=${encodeURIComponent(student.nrp)}`} download />}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
                  <FileDown className="size-5" />
                </span>
                <span className="flex flex-col items-start text-left leading-tight">
                  <span className="text-sm font-semibold">Unduh Raport (PDF)</span>
                  <span className="text-[11px] font-normal text-white/85">Rekap resmi · siap disimpan & dicetak</span>
                </span>
              </Button>
            ) : (
              <Button disabled className="h-auto w-full gap-3 border-0 bg-red-600 py-3 text-white disabled:opacity-50">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
                  <Lock className="size-5" />
                </span>
                <span className="flex flex-col items-start text-left leading-tight">
                  <span className="text-sm font-semibold">Unduh Raport (PDF)</span>
                  <span className="text-[11px] font-normal text-white/85">Tersedia setelah raport difinalisasi PSDM</span>
                </span>
              </Button>
            )}

            <StudentRaportView student={student} computed={computed} final={!!student.raportSnapshot} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
