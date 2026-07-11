"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UploadCloud, AlertCircle, CheckCircle2, FileText, Info } from "lucide-react";
import { ImportType } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { importCsvAction } from "@/app/(dashboard)/admin/actions";

const SCHEMAS: Record<ImportType, { title: string; cols: string[]; desc: string; sample: string }> = {
  [ImportType.PERSONALITY]: {
    title: "Profil Kepribadian (MBTI)",
    cols: ["nrp", "mbtiType", "temperament"],
    desc: "Mengimpor hasil tes MBTI dan 4 Temperament mahasiswa baru.",
    sample: "nrp,mbtiType,temperament\n2512345678,INTJ,Melankolis\n2598765432,ENFP,Sanguinis",
  },
  [ImportType.BASELINE_K1]: {
    title: "Kuesioner Baseline (K1)",
    cols: ["nrp", "submitted"],
    desc: "Menandai status pengisian kuesioner awal (K1) mahasiswa baru.",
    sample: "nrp,submitted\n2512345678,true\n2598765432,true",
  },
  [ImportType.REFLECTION_K2]: {
    title: "Kuesioner Refleksi (K2)",
    cols: ["nrp", "submitted"],
    desc: "Menandai status pengisian kuesioner refleksi akhir (K2) mahasiswa baru.",
    sample: "nrp,submitted\n2512345678,true\n2598765432,false",
  },
  [ImportType.LOGBOOK]: {
    title: "Logbook Kegiatan Maba",
    cols: ["nrp", "periodLabel", "content"],
    desc: "Mengimpor isi logbook mingguan yang ditulis maba dari GForm.",
    sample: "nrp,periodLabel,content\n2512345678,Minggu 1,Hari ini saya belajar dasar programming...\n2598765432,Minggu 1,Melakukan perkenalan unit mentoring...",
  },
  [ImportType.PROKER]: {
    title: "Presensi Proker Fakultas",
    cols: ["nrp", "prokerCode", "status"],
    desc: "Mengimpor data kehadiran maba di proker fakultas (PESRAF, ARUS_EMAS, SOSCOM, DIESNAT).",
    sample: "nrp,prokerCode,status\n2512345678,PESRAF,HADIR\n2598765432,PESRAF,ALPA\n2512345678,ARUS_EMAS,IZIN",
  },
  // Placeholders not used by standard import pages directly
  [ImportType.STUDENTS]: { title: "Daftar Maba", cols: ["nrp", "name"], desc: "", sample: "" },
  [ImportType.ACCOUNTS]: { title: "Daftar Akun", cols: ["nrp", "name"], desc: "", sample: "" },
  [ImportType.POST_TEST]: { title: "Post Test", cols: [], desc: "", sample: "" },
};

type MismatchRow = {
  rowNumber: number;
  nrp: string;
  reason: string;
};

export function ImportUploader() {
  const [importType, setImportType] = useState<ImportType>(ImportType.PERSONALITY);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  // Results State
  const [hasResult, setHasResult] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedRows, setFailedRows] = useState<MismatchRow[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast.error("Silakan pilih file CSV terlebih dahulu.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error("Gagal membaca isi file.");
        return;
      }

      startTransition(async () => {
        const result = await importCsvAction(importType, file.name, text);
        if (result.ok) {
          toast.success(result.summary || "Impor berhasil diselesaikan.");
          
          // Re-fetch database import details or manually compute from log
          // To keep it immediate, we reload window or query import status.
          // Let's force reload window after 2.5s so they see the logs, or display client state.
          // Since we want to display the reports immediately on the client side:
          // Let's do a trick: we can query the latest import records in the parent page and show them.
          // Or we can parse the CSV on client first and check. But doing it on the server is safer.
          // Let's let the page reload to refresh the import logs at the bottom.
          setHasResult(true);
          window.location.reload();
        } else {
          toast.error(result.error);
        }
      });
    };
    reader.readAsText(file);
  };

  const schemaInfo = SCHEMAS[importType];

  return (
    <div className="space-y-6 text-xs">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pengunggah Berkas CSV</CardTitle>
          <CardDescription className="text-xs">Unggah file hasil ekspor GForm atau presensi eksternal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="import-type" className="font-semibold">Jenis Data Impor</Label>
            <Select value={importType} onValueChange={(val) => setImportType(val as ImportType)}>
              <SelectTrigger id="import-type" className="w-[280px]">
                <SelectValue placeholder="Pilih Jenis Data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ImportType.PERSONALITY}>Profil Kepribadian (MBTI & Temperament)</SelectItem>
                <SelectItem value={ImportType.BASELINE_K1}>Kuesioner Baseline (K1)</SelectItem>
                <SelectItem value={ImportType.REFLECTION_K2}>Kuesioner Refleksi (K2)</SelectItem>
                <SelectItem value={ImportType.LOGBOOK}>Logbook Mingguan Maba</SelectItem>
                <SelectItem value={ImportType.PROKER}>Kehadiran Proker Fakultas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Schema Guide Box */}
          <div className="border rounded-lg p-3.5 bg-muted/30 space-y-2">
            <h4 className="font-semibold text-foreground flex items-center gap-1">
              <Info className="size-3.5" />
              Panduan Skema Kolom CSV untuk: {schemaInfo.title}
            </h4>
            <p className="text-muted-foreground">{schemaInfo.desc}</p>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Kolom yang Wajib Ada (Case Insensitive):</p>
              <div className="flex gap-1.5 flex-wrap">
                {schemaInfo.cols.map((col) => (
                  <code key={col} className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-mono font-bold">
                    {col}
                  </code>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="font-semibold text-foreground">Contoh Isi File CSV:</p>
              <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-md font-mono text-[10px] whitespace-pre overflow-x-auto border border-slate-800">
                {schemaInfo.sample}
              </pre>
            </div>
          </div>

          {/* Upload Input */}
          <div className="grid gap-2">
            <Label className="font-semibold">Pilih File CSV</Label>
            <div className="border-2 border-dashed rounded-xl p-6 text-center hover:bg-muted/10 transition-colors flex flex-col items-center justify-center gap-2">
              <UploadCloud className="size-8 text-muted-foreground" />
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file-input"
              />
              <Label htmlFor="csv-file-input" className="cursor-pointer font-semibold text-primary hover:underline">
                {file ? file.name : "Klik di sini untuk memilih file CSV"}
              </Label>
              <span className="text-[10px] text-muted-foreground">Format file harus berupa .csv berpemisah koma (,)</span>
            </div>
          </div>

          <Button onClick={handleUpload} disabled={pending || !file} className="w-full">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            Proses dan Impor Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
