"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UploadCloud, Info } from "lucide-react";
import { ImportType } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { importCsvAction } from "@/app/(dashboard)/admin/actions";

const SCHEMAS: Record<ImportType, { title: string; cols: string[]; desc: string; sample: string }> = {
  [ImportType.STUDENTS]: {
    title: "Daftar Maba (Bootstrap Awal)",
    cols: ["nrp", "name", "unit_code", "department_code"],
    desc: "Mendaftarkan atau memperbarui data induk mahasiswa baru — unit_code harus sudah ada di Master Data.",
    sample: "nrp,name,unit_code,department_code\n2512345678,Budi Santoso,R01-U01,DEP1\n2598765432,Citra Wijaya,R01-U01,DEP2",
  },
  [ImportType.ACCOUNTS]: {
    title: "Daftar Akun (Mentor/KR/Damen)",
    cols: ["nrp", "name", "role", "unit_code", "region_code", "password"],
    desc: "Membuat akun baru. role = ADMIN/KEPALA_REGION/MENTOR/DAMEN. Tidak akan menimpa password akun yang sudah ada.",
    sample: "nrp,name,role,unit_code,region_code,password\nmentor.r01-u02,Mentor Baru,MENTOR,R01-U02,,gradaks2026",
  },
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
    desc: "Mengimpor isi logbook mingguan yang ditulis maba dari GForm — setiap baris jadi entri baru untuk diverifikasi mentor.",
    sample: "nrp,periodLabel,content\n2512345678,Minggu 1,Hari ini saya belajar dasar programming...\n2598765432,Minggu 1,Melakukan perkenalan unit mentoring...",
  },
  [ImportType.POST_TEST]: {
    title: "Nilai Post-test (Tipe D)",
    cols: ["nrp", "activity_code", "material_code", "parameter_subcode", "value"],
    desc: "Mengimpor nilai post-test/pengujian ke parameter yang sudah ada di Master Data (mis. Wawasan FTEIC).",
    sample: "nrp,activity_code,material_code,parameter_subcode,value\n2512345678,INCLENATION,WAWASAN_FTEIC,D1,88",
  },
  [ImportType.PROKER]: {
    title: "Presensi Proker Fakultas",
    cols: ["nrp", "session_code", "status"],
    desc: "Mengimpor data kehadiran maba di proker fakultas (PESRAF, ARUS_EMAS, SOSCOM, DIESNAT).",
    sample: "nrp,session_code,status\n2512345678,PESRAF,HADIR\n2598765432,PESRAF,ALPA\n2512345678,ARUS_EMAS,IZIN",
  },
};

const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  [ImportType.STUDENTS]: "Daftar Maba (Bootstrap)",
  [ImportType.ACCOUNTS]: "Daftar Akun",
  [ImportType.PERSONALITY]: "Profil Kepribadian (MBTI & Temperament)",
  [ImportType.BASELINE_K1]: "Kuesioner Baseline (K1)",
  [ImportType.REFLECTION_K2]: "Kuesioner Refleksi (K2)",
  [ImportType.LOGBOOK]: "Logbook Mingguan Maba",
  [ImportType.POST_TEST]: "Nilai Post-test",
  [ImportType.PROKER]: "Kehadiran Proker Fakultas",
};

export function ImportUploader() {
  const [importType, setImportType] = useState<ImportType>(ImportType.PERSONALITY);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

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
          // Batch + per-row report is shown in the history list below this
          // uploader (rendered by the parent Server Component), so a router
          // refresh is enough to reveal it — no local result state needed.
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
            <Select value={importType} onValueChange={(val) => val && setImportType(val as ImportType)}>
              <SelectTrigger id="import-type" className="w-[280px]">
                <SelectValue placeholder="Pilih Jenis Data" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(IMPORT_TYPE_LABELS) as ImportType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {IMPORT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
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
