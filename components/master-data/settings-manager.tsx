"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, AlertCircle, MessageSquare, CheckSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import { updateSettingsAction } from "@/app/(dashboard)/admin/master-data/actions";
import {
  SETTING_KEYS,
  DEFAULT_TEMU_ABSENCE_THRESHOLD,
  DEFAULT_TEMU_OFFLINE_ABSENCE_THRESHOLD,
  DEFAULT_DATA_INSUFFICIENT_MESSAGE,
  DEFAULT_REMINDER_MESSAGE_TEMPLATE,
  DEFAULT_ATTENDANCE_STATUS_SCORES,
  DEFAULT_ATTENDANCE_MAPPING,
  DEFAULT_PARTICIPATION_MAPPING,
} from "@/lib/scoring/setting-keys";

type SettingData = {
  key: string;
  value: any;
};

const SUB_NILAI_OPTIONS = [
  { code: "A.1", label: "Kebersamaan", group: "Kolektif" },
  { code: "A.2", label: "Kebanggaan Fakultas", group: "Kolektif" },
  { code: "B.1", label: "Manajemen Diri", group: "Kolaborasi" },
  { code: "B.2", label: "Kerja Sama", group: "Kolaborasi" },
  { code: "C.1", label: "Problem Solving", group: "Kontribusi" },
  { code: "C.2", label: "Kepekaan Sosial", group: "Kontribusi" },
];

export function SettingsManager({ initialSettings }: { initialSettings: SettingData[] }) {
  const [pending, startTransition] = useTransition();

  const getSettingValue = (key: string, fallback: any) => {
    const s = initialSettings.find((x) => x.key === key);
    return s !== undefined && s.value !== null ? s.value : fallback;
  };

  const [calibrationThreshold, setCalibrationThreshold] = useState(String(getSettingValue(SETTING_KEYS.calibrationThreshold, 0.6)));
  const [damenEnabled, setDamenEnabled] = useState(!!getSettingValue(SETTING_KEYS.damenEnabled, false));
  const [temuAbsenceThreshold, setTemuAbsenceThreshold] = useState(
    String(getSettingValue(SETTING_KEYS.temuAbsenceThreshold, DEFAULT_TEMU_ABSENCE_THRESHOLD)),
  );
  const [temuOfflineAbsenceThreshold, setTemuOfflineAbsenceThreshold] = useState(
    String(getSettingValue(SETTING_KEYS.temuOfflineAbsenceThreshold, DEFAULT_TEMU_OFFLINE_ABSENCE_THRESHOLD)),
  );
  const [dataInsufficientMessage, setDataInsufficientMessage] = useState(
    String(getSettingValue(SETTING_KEYS.dataInsufficientMessage, DEFAULT_DATA_INSUFFICIENT_MESSAGE)),
  );

  const [reminderMessageTemplate, setReminderMessageTemplate] = useState(
    String(getSettingValue(SETTING_KEYS.reminderMessageTemplate, DEFAULT_REMINDER_MESSAGE_TEMPLATE)),
  );

  // Attendance Status Scores State
  const initialStatusScores = getSettingValue(SETTING_KEYS.attendanceStatusScores, DEFAULT_ATTENDANCE_STATUS_SCORES);
  const [hadirScore, setHadirScore] = useState(String(initialStatusScores.HADIR ?? 100));
  const [izinScore, setIzinScore] = useState(String(initialStatusScores.IZIN ?? 50));
  const [alpaScore, setAlpaScore] = useState(String(initialStatusScores.ALPA ?? 0));

  // Attendance Mapping State: Record<sessionCode, subCode[]>
  const initialMapping = getSettingValue(SETTING_KEYS.attendanceMapping, DEFAULT_ATTENDANCE_MAPPING);
  const [attendanceMapping, setAttendanceMapping] = useState<Record<string, string[]>>(initialMapping);
  const [newSessionCode, setNewSessionCode] = useState("");

  // Participation Mapping State: Record<sessionCode, subCode[]> (DEFAULT is fallback for regular sessions)
  const initialPartMapping = getSettingValue(SETTING_KEYS.participationMapping, DEFAULT_PARTICIPATION_MAPPING);
  const [participationMapping, setParticipationMapping] = useState<Record<string, string[]>>(initialPartMapping);

  const handleToggleMapping = (sessionCode: string, subCode: string) => {
    setAttendanceMapping((prev) => {
      const current = prev[sessionCode] || [];
      const updated = current.includes(subCode) ? current.filter((x) => x !== subCode) : [...current, subCode];
      return { ...prev, [sessionCode]: updated };
    });
  };

  const handleTogglePartMapping = (sessionCode: string, subCode: string) => {
    setParticipationMapping((prev) => {
      const current = prev[sessionCode] || [];
      const updated = current.includes(subCode) ? current.filter((x) => x !== subCode) : [...current, subCode];
      return { ...prev, [sessionCode]: updated };
    });
  };

  const handleAddSessionMapping = () => {
    const code = newSessionCode.trim().toUpperCase();
    if (!code) {
      toast.error("Masukkan kode sesi terlebih dahulu.");
      return;
    }
    if (attendanceMapping[code]) {
      toast.error(`Kode sesi "${code}" sudah ada dalam pemetaan.`);
      return;
    }
    setAttendanceMapping((prev) => ({ ...prev, [code]: ["A.1"] }));
    setNewSessionCode("");
    toast.success(`Sesi "${code}" berhasil ditambahkan ke pemetaan.`);
  };

  const handleRemoveSessionMapping = (code: string) => {
    setAttendanceMapping((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const settings = {
        [SETTING_KEYS.calibrationThreshold]: Number(calibrationThreshold),
        [SETTING_KEYS.damenEnabled]: damenEnabled,
        [SETTING_KEYS.temuAbsenceThreshold]: Number(temuAbsenceThreshold),
        [SETTING_KEYS.temuOfflineAbsenceThreshold]: Number(temuOfflineAbsenceThreshold),
        [SETTING_KEYS.dataInsufficientMessage]: dataInsufficientMessage,
        [SETTING_KEYS.reminderMessageTemplate]: reminderMessageTemplate,
        [SETTING_KEYS.attendanceStatusScores]: {
          HADIR: Number(hadirScore),
          IZIN: Number(izinScore),
          ALPA: Number(alpaScore),
        },
        [SETTING_KEYS.attendanceMapping]: attendanceMapping,
        [SETTING_KEYS.participationMapping]: participationMapping,
      };

      const res = await updateSettingsAction(settings);
      if (res.ok) {
        toast.success("Konfigurasi, pemetaan presensi, dan keaktifan berhasil disimpan.");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Pengaturan & Pemetaan Presensi</h3>
          <p className="text-xs text-muted-foreground">Atur nilai status presensi, ambang batas, dan pemetaan sesi ke Nilai Personal maba.</p>
        </div>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Simpan Konfigurasi
        </Button>
      </div>

      <div className="grid gap-6 text-xs">
        {/* Attendance Score & Sub-Nilai Mapping Manager */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckSquare className="size-4 text-primary" />
              Pengaturan Skor & Pemetaan Presensi / Keaktifan Sesi ke Sub-Nilai Personal
            </CardTitle>
            <CardDescription className="text-[10px]">
              Tentukan bobot skor status presensi (HADIR/IZIN/ALPA) serta atur Sub-Nilai mana saja yang dipengaruhi oleh Status Kehadiran dan Nilai Keaktifan Mentor (1-4).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Scores Configuration */}
            <div className="space-y-2">
              <h4 className="font-semibold text-xs text-foreground">1. Skor Bobot Status Presensi (Skala 0-100)</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1 border rounded-lg p-2 bg-background">
                  <Label htmlFor="score-hadir" className="text-[11px] font-medium text-green-600">HADIR</Label>
                  <Input
                    id="score-hadir"
                    type="number"
                    value={hadirScore}
                    onChange={(e) => setHadirScore(e.target.value)}
                    className="h-7 text-xs font-mono font-bold"
                  />
                </div>
                <div className="grid gap-1 border rounded-lg p-2 bg-background">
                  <Label htmlFor="score-izin" className="text-[11px] font-medium text-amber-600">IZIN</Label>
                  <Input
                    id="score-izin"
                    type="number"
                    value={izinScore}
                    onChange={(e) => setIzinScore(e.target.value)}
                    className="h-7 text-xs font-mono font-bold"
                  />
                </div>
                <div className="grid gap-1 border rounded-lg p-2 bg-background">
                  <Label htmlFor="score-alpa" className="text-[11px] font-medium text-red-600">ALPA / Kosong</Label>
                  <Input
                    id="score-alpa"
                    type="number"
                    value={alpaScore}
                    onChange={(e) => setAlpaScore(e.target.value)}
                    className="h-7 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Session Sub-Nilai Mapping Table */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h4 className="font-semibold text-xs text-foreground">2. Pemetaan Status Kehadiran (HADIR/IZIN/ALPA) ke Sub-Nilai</h4>
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="Kode Sesi Baru (misal: TEMU_1)"
                    value={newSessionCode}
                    onChange={(e) => setNewSessionCode(e.target.value)}
                    className="h-7 text-xs font-mono w-48"
                  />
                  <Button size="xs" variant="outline" onClick={handleAddSessionMapping}>
                    <Plus className="size-3" /> Tambah Sesi
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border bg-background">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground font-medium text-[11px]">
                      <th className="p-2.5 w-36">Kode Sesi</th>
                      <th className="p-2.5">Tujuan Sub-Nilai Personal (Status Presensi)</th>
                      <th className="p-2.5 w-16 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.keys(attendanceMapping).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-muted-foreground">Belum ada pemetaan sesi.</td>
                      </tr>
                    ) : (
                      Object.entries(attendanceMapping).map(([code, targets]) => (
                        <tr key={code} className="hover:bg-muted/20">
                          <td className="p-2.5 font-mono font-bold">
                            <span className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
                              {code}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-4 flex-wrap">
                              {SUB_NILAI_OPTIONS.map((sub) => {
                                const checked = targets.includes(sub.code);
                                return (
                                  <label
                                    key={sub.code}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer select-none text-[11px] transition-colors ${
                                      checked ? "bg-primary/10 border-primary/30 font-semibold text-primary" : "bg-muted/10 border-muted text-muted-foreground hover:bg-muted/30"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() => handleToggleMapping(code, sub.code)}
                                      className="size-3.5"
                                    />
                                    <span>
                                      <strong className="font-mono">{sub.code}</strong> {sub.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-2.5 text-right">
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveSessionMapping(code)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Participation Score Mapping Table */}
            <div className="space-y-3 pt-2">
              <h4 className="font-semibold text-xs text-foreground">3. Pemetaan Skor Keaktifan Mentor (Skala 1-4) ke Sub-Nilai</h4>
              <p className="text-[10px] text-muted-foreground">
                Tentukan Sub-Nilai mana yang menerima masukan skor keaktifan maba (1-4) dari mentor pada sesi rutin.
              </p>
              <div className="overflow-x-auto rounded-lg border bg-background">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground font-medium text-[11px]">
                      <th className="p-2.5 w-36">Berlaku Untuk</th>
                      <th className="p-2.5">Tujuan Sub-Nilai Personal (Skor Keaktifan 1-4)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr className="hover:bg-muted/20">
                      <td className="p-2.5 font-mono font-bold">
                        <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          DEFAULT (Sesi Rutin)
                        </span>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-4 flex-wrap">
                          {SUB_NILAI_OPTIONS.map((sub) => {
                            const targets = participationMapping["DEFAULT"] || ["B.2", "C.1"];
                            const checked = targets.includes(sub.code);
                            return (
                              <label
                                key={sub.code}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer select-none text-[11px] transition-colors ${
                                  checked ? "bg-emerald-500/10 border-emerald-500/30 font-semibold text-emerald-600" : "bg-muted/10 border-muted text-muted-foreground hover:bg-muted/30"
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => handleTogglePartMapping("DEFAULT", sub.code)}
                                  className="size-3.5"
                                />
                                <span>
                                  <strong className="font-mono">{sub.code}</strong> {sub.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calibration & Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="size-4 text-primary" />
              Kalibrasi, Verifikasi, & Ambang Batas Kelulusan
            </CardTitle>
            <CardDescription className="text-[10px]">
              Parameter deteksi penyimpangan dan penguncian verifikasi akhir.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cal-thresh">Ambang Deviasi Kalibrasi Mentor</Label>
              <Input
                id="cal-thresh"
                type="number"
                step="0.1"
                value={calibrationThreshold}
                onChange={(e) => setCalibrationThreshold(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">Batas deviasi rata-rata skor mentor sebelum ditandai merah (default: 0.6).</span>
            </div>

            <div className="flex flex-col gap-2 justify-center items-start border rounded-lg p-3 bg-muted/20">
              <div className="flex items-center justify-between w-full">
                <Label htmlFor="damen-toggle" className="font-semibold cursor-pointer">Verifikasi Lapis Damen Aktif</Label>
                <Switch
                  id="damen-toggle"
                  checked={damenEnabled}
                  onCheckedChange={setDamenEnabled}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                Jika aktif, pemeriksaan kelengkapan harus disetujui Damen terlebih dahulu sebelum PSDM dapat melakukan verifikasi akhir.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Attendance data-insufficiency gate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="size-4 text-primary" />
              Gate Presensi Temu FTEIC (&ldquo;Tidak Dapat Diagregasi&rdquo;)
            </CardTitle>
            <CardDescription className="text-[10px]">
              Maba yang melampaui kedua ambang ini tetap tampil nilainya di raport, tapi statusnya berubah menjadi &ldquo;Tidak Dapat
              Diagregasi&rdquo; dan tidak dievaluasi oleh Rule Rekomendasi — datanya diserahkan ke HMD untuk pendampingan lebih lanjut.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="temu-absence-thresh">Ambang Absen Temu FTEIC (lebih dari)</Label>
              <Input
                id="temu-absence-thresh"
                type="number"
                min="0"
                step="1"
                value={temuAbsenceThreshold}
                onChange={(e) => setTemuAbsenceThreshold(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">Jumlah absen (izin/alpa) di seluruh sesi Temu FTEIC sebelum gate aktif (default: 2).</span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="temu-offline-absence-thresh">Ambang Absen Sesi Offline Temu FTEIC (lebih dari)</Label>
              <Input
                id="temu-offline-absence-thresh"
                type="number"
                min="0"
                step="1"
                value={temuOfflineAbsenceThreshold}
                onChange={(e) => setTemuOfflineAbsenceThreshold(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">Jumlah absen (izin/alpa) khusus di sesi offline Temu FTEIC sebelum gate aktif (default: 1).</span>
            </div>
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor="data-insufficient-msg">Pesan Peringatan (tampil di raport maba)</Label>
              <Textarea
                id="data-insufficient-msg"
                value={dataInsufficientMessage}
                onChange={(e) => setDataInsufficientMessage(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Reminder WhatsApp ke Mentor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              Reminder WhatsApp ke Mentor
            </CardTitle>
            <CardDescription className="text-[10px]">
              Dikirim manual dari tombol &ldquo;Kirim Reminder&rdquo; / &ldquo;Ingatkan Semua yang Belum Lengkap&rdquo; di halaman
              Tracking Unit. Template di bawah ini yang dipakai untuk isi pesannya.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="reminder-template">Template Pesan</Label>
              <Textarea
                id="reminder-template"
                value={reminderMessageTemplate}
                onChange={(e) => setReminderMessageTemplate(e.target.value)}
                rows={3}
              />
              <span className="text-[10px] text-muted-foreground">
                Placeholder yang tersedia: <code className="font-mono">{"{{mentorName}}"}</code>{" "}
                <code className="font-mono">{"{{unitCode}}"}</code> <code className="font-mono">{"{{unitName}}"}</code>{" "}
                <code className="font-mono">{"{{attPct}}"}</code> <code className="font-mono">{"{{scorePct}}"}</code>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
