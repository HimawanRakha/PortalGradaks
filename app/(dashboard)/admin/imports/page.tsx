import type { Metadata } from "next";
import { History, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { ImportUploader } from "@/components/admin/import-uploader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Pusat Impor Data - Admin" };

export default async function ImportsPage() {
  await assertRole(Role.ADMIN);

  // Fetch recent import batches along with their rows that failed/skipped
  const recentImports = await prisma.import.findMany({
    include: {
      importedBy: { select: { name: true } },
      rows: {
        where: {
          action: { in: ["FAILED", "SKIPPED_NO_MATCH"] },
        },
        select: {
          id: true,
          rowNumber: true,
          rawData: true,
          action: true,
          errorReason: true,
        },
        orderBy: { rowNumber: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6 text-xs">
      <div>
        <h2 className="text-xl font-semibold">Pusat Impor Data Eksternal</h2>
        <p className="text-sm text-muted-foreground">
          Unggah data kepribadian, kelengkapan kuesioner, logbook, dan presensi proker fakultas dari CSV.
        </p>
      </div>

      <ImportUploader />

      {/* Import History & Mismatch Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            <History className="size-4.5 text-primary" />
            Riwayat Batch Impor & Laporan Mismatch
          </CardTitle>
          <CardDescription className="text-xs">
            Daftar batch impor terbaru beserta rincian baris data yang gagal dicocokkan (NRP salah/tidak terdaftar).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentImports.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Belum ada riwayat impor data.</p>
          ) : (
            <div className="space-y-4">
              {recentImports.map((batch) => (
                <div key={batch.id} className="border rounded-xl p-3 bg-muted/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{batch.fileName}</span>
                      <Badge variant="secondary" className="font-mono text-[9px] uppercase">
                        {batch.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Oleh {batch.importedBy.name} pada {new Date(batch.createdAt).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex gap-1.5 text-[10px]">
                      <span className="bg-green-500/10 text-green-500 border border-green-500/20 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> {batch.matchedRows} Cocok
                      </span>
                      {batch.failedRows > 0 && (
                        <span className="bg-red-500/10 text-red-500 border border-red-500/20 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="size-3" /> {batch.failedRows} Gagal/Mismatch
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Failed rows / mismatch list */}
                  {batch.rows.length > 0 ? (
                    <div className="space-y-2">
                      <p className="font-bold text-destructive flex items-center gap-1">
                        <AlertTriangle className="size-3.5" />
                        Rincian Baris Gagal Cocok / Error (Total {batch.rows.length} baris):
                      </p>
                      <div className="overflow-x-auto rounded-lg border max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-[11px] border-collapse bg-background">
                          <thead>
                            <tr className="bg-muted/40 border-b text-muted-foreground font-medium sticky top-0 bg-muted">
                              <th className="p-2 w-20 text-center">Baris ke-</th>
                              <th className="p-2">Data Asli CSV</th>
                              <th className="p-2">Penyebab Gagal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y font-mono">
                            {batch.rows.map((row) => (
                              <tr key={row.id} className="hover:bg-muted/20">
                                <td className="p-2 text-center text-muted-foreground font-bold">{row.rowNumber}</td>
                                <td className="p-2 text-[10px] max-w-xs truncate" title={JSON.stringify(row.rawData)}>
                                  {JSON.stringify(row.rawData)}
                                </td>
                                <td className="p-2 text-red-500 text-[10px] font-sans font-medium">{row.errorReason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-green-600 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5" />
                      Seluruh baris data pada batch ini berhasil diimpor dan dicocokkan dengan NRP maba!
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
