import type { Metadata } from "next";
import { Download, FileSpreadsheet, AlertCircle, Info, Database, TableProperties } from "lucide-react";
import { assertRole } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Ekspor Data - Admin" };

export default async function ExportsPage() {
  await assertRole(Role.ADMIN);

  const TABS_EXPLAIN = [
    {
      icon: Database,
      name: "Long Mentah",
      description: "Data mentah transaksi nilai ter-normalisasi per mahasiswa per sesi pertemuan. Berisi 15 kolom detail untuk di-upload/sync.",
    },
    {
      icon: TableProperties,
      name: "Wide per Kegiatan",
      description: "Data lebar di mana setiap parameter menjadi kolom tersendiri (format: MATERI_SUBKODE). Cocok untuk statistik korelasi.",
    },
    {
      icon: Info,
      name: "Pre-Post SPSS",
      description: "Data perbandingan kuesioner awal (K1) vs akhir (K2) berpasangan serta analisis delta perubahan kompetensi JAD.",
    },
    {
      icon: FileSpreadsheet,
      name: "Persebaran HMD (DB7)",
      description: "Rekapitulasi total mahasiswa baru aktif per HMD (Himpunan Mahasiswa Departemen) untuk serah terima laporan.",
    },
  ];

  return (
    <div className="space-y-6 text-xs">
      <div>
        <h2 className="text-xl font-semibold">Pusat Ekspor Data Utama</h2>
        <p className="text-sm text-muted-foreground">
          Unduh laporan kelengkapan dan nilai maba dalam satu berkas spreadsheet multi-tab yang valid.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            <FileSpreadsheet className="size-4.5 text-primary" />
            Ekspor Data Utama (.xlsx)
          </CardTitle>
          <CardDescription className="text-xs">
            Format file sepenuhnya kompatibel dengan Microsoft Excel, Google Sheets, dan impor langsung ke software statistik IBM SPSS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tabs Details */}
          <div className="grid gap-4 sm:grid-cols-2">
            {TABS_EXPLAIN.map((tab, idx) => (
              <div key={idx} className="border rounded-xl p-3 bg-muted/20 flex gap-3 items-start">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <tab.icon className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{tab.name}</p>
                  <p className="text-muted-foreground leading-relaxed">{tab.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-l-4 border-l-blue-500 bg-blue-500/5 p-3 rounded-lg flex items-start gap-2.5">
            <AlertCircle className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">Standardisasi Variabel SPSS:</p>
              <p className="text-muted-foreground">
                Judul kolom wide-format mematuhi standar penamaan variabel SPSS (dimulai dengan huruf, tidak mengandung spasi, dan memakai pemisah underscore).
              </p>
            </div>
          </div>

          {/* Download Action */}
          <a href="/api/export?type=main" download>
            <Button size="lg" className="w-full h-11 text-sm font-semibold mt-2">
              <Download className="size-4.5" />
              Unduh Ekspor Spreadsheet Lengkap
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
