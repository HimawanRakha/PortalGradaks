"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, FileCheck, CheckCircle2, ShieldAlert, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { finalizeRaportsAction } from "@/app/(dashboard)/admin/actions";

type SnapshotItem = {
  id: string;
  studentName: string;
  studentNrp: string;
  personalScore: number;
  skillScore: number;
  recommendation: string | null;
  finalizedAt: Date;
  finalizedByName: string;
};

export function Finalizer({
  totalMaba,
  finalizedCount,
  snapshots,
}: {
  totalMaba: number;
  finalizedCount: number;
  snapshots: SnapshotItem[];
}) {
  const [pending, startTransition] = useTransition();

  const handleFinalize = () => {
    if (!confirm("Apakah Anda yakin ingin melakukan finalisasi dan membekukan raport saat ini? Tindakan ini akan mengoverwrite snapshot sebelumnya jika sudah pernah dijalankan.")) return;

    startTransition(async () => {
      const res = await finalizeRaportsAction();
      if (res.ok) {
        toast.success(res.summary || "Finalisasi raport maba berhasil!");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const pendingCount = Math.max(0, totalMaba - finalizedCount);

  return (
    <div className="space-y-6 text-xs">
      {/* Finalization Card Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            <FileCheck className="size-4.5 text-primary" />
            Kalkulasi & Pembekuan Raport Maba
          </CardTitle>
          <CardDescription className="text-xs">
            Proses ini akan menghitung Nilai Personal dan Nilai Keahlian seluruh maba secara terpusat lalu menyimpannya sebagai snapshot resmi yang tidak dapat diubah secara retroaktif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="border rounded-xl p-3 bg-muted/20 text-center">
              <p className="text-muted-foreground font-medium">Total Mahasiswa</p>
              <p className="text-2xl font-bold text-foreground mt-1 font-mono">{totalMaba}</p>
            </div>
            <div className="border rounded-xl p-3 bg-green-500/5 text-center border-green-500/20">
              <p className="text-green-600 dark:text-green-400 font-medium">Sudah Finalisasi</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1 font-mono">{finalizedCount}</p>
            </div>
            <div className="border rounded-xl p-3 bg-amber-500/5 text-center border-amber-500/20 col-span-2 sm:col-span-1">
              <p className="text-amber-500 font-medium font-sans">Belum Finalisasi / Pending</p>
              <p className="text-2xl font-bold text-amber-500 mt-1 font-mono">{pendingCount}</p>
            </div>
          </div>

          <div className="border-l-4 border-l-amber-500 bg-amber-500/5 p-3.5 rounded-lg space-y-1 text-foreground">
            <p className="font-bold flex items-center gap-1">
              <ShieldAlert className="size-3.5 text-amber-500" /> Ketentuan Kelulusan Minimum:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-muted-foreground">
              <li>Kehadiran & Keaktifan minimal 70% di sesi pertemuan.</li>
              <li>Lolos tes Mars Electics dengan nilai minimal 70.</li>
              <li>Maba yang tidak memenuhi kriteria di atas otomatis ditandai <strong>TIDAK LULUS</strong>.</li>
            </ul>
          </div>

          <Button
            size="lg"
            className="w-full h-10 text-sm font-semibold"
            onClick={handleFinalize}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Mulai Finalisasi & Buat Snapshot
          </Button>
        </CardContent>
      </Card>

      {/* Snapshot Tables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            <Award className="size-4.5 text-primary" />
            Snapshot Raport Terakhir ({finalizedCount})
          </CardTitle>
          <CardDescription className="text-xs">
            Daftar raport resmi yang dibekukan pada snapshot terakhir.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {snapshots.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Belum ada data snapshot raport yang dibekukan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                    <th className="p-3">Maba / NRP</th>
                    <th className="p-3 text-center">Nilai Personal</th>
                    <th className="p-3 text-center">Nilai Keahlian</th>
                    <th className="p-3">Rekomendasi Hasil</th>
                    <th className="p-3">Dibekukan Oleh</th>
                    <th className="p-3">Waktu Finalisasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium">
                  {snapshots.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <p className="font-bold text-foreground text-xs">{s.studentName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{s.studentNrp}</p>
                      </td>
                      <td className="p-3 text-center font-mono font-bold">{s.personalScore.toFixed(1)}</td>
                      <td className="p-3 text-center font-mono font-bold">{s.skillScore.toFixed(1)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.recommendation === "LULUS" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                          s.recommendation?.startsWith("TIDAK") ? "bg-red-500/10 text-red-500 border-red-500/20" :
                          "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}>
                          {s.recommendation}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{s.finalizedByName}</td>
                      <td className="p-3 text-muted-foreground font-mono">
                        {new Date(s.finalizedAt).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
