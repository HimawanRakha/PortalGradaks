import type { Metadata } from "next";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computeScores } from "@/lib/scoring/calculate";
import { StudentRaportView, studentRaportInclude } from "@/components/scoring/student-raport-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Cek Raport Maba" };

// Public, unauthenticated lookup (see proxy.ts's "/cek-raport" exemption) — a
// maba proves nothing beyond knowing their own NRP. Deliberately reuses the
// same live computeScores() the mentor view uses rather than only reading
// RaportSnapshot, so progress is visible all program long, not just after
// PSDM finalization; the snapshot (once it exists) only adds the "official,
// frozen" banner on top.
export default async function CekRaportPage({ searchParams }: { searchParams: Promise<{ nrp?: string }> }) {
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

  const computed = student ? await computeScores(student.id) : null;

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
          <div className="w-full space-y-4">
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
              <Alert className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                <CheckCircle2 className="size-4" />
                <AlertTitle className="font-semibold">Raport Final — {student.raportSnapshot.recommendation}</AlertTitle>
                <AlertDescription className="text-xs mt-1 text-emerald-700/90 dark:text-emerald-400/90">
                  Dibekukan{" "}
                  {student.raportSnapshot.finalizedAt.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  . Nilai di bawah ini adalah nilai resmi akhir dan tidak lagi berubah.
                  {student.raportSnapshot.description ? (
                    <span className="mt-1 block">{student.raportSnapshot.description}</span>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="w-full">
                <AlertTitle className="text-sm font-semibold">Belum difinalisasi</AlertTitle>
                <AlertDescription className="text-xs">
                  Nilai di bawah ini adalah estimasi berjalan, bukan nilai resmi akhir. Nilai resmi akan muncul di sini
                  setelah PSDM melakukan finalisasi raport.
                </AlertDescription>
              </Alert>
            )}

            <StudentRaportView student={student} computed={computed} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
