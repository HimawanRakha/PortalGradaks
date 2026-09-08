"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, AlertCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { updateSettingsAction } from "@/app/(dashboard)/admin/master-data/actions";
import {
  SETTING_KEYS,
  DEFAULT_TEMU_ABSENCE_THRESHOLD,
  DEFAULT_TEMU_OFFLINE_ABSENCE_THRESHOLD,
  DEFAULT_DATA_INSUFFICIENT_MESSAGE,
  DEFAULT_REMINDER_SEND_HOUR,
  DEFAULT_REMINDER_COOLDOWN_HOURS,
  DEFAULT_REMINDER_MESSAGE_TEMPLATE,
} from "@/lib/scoring/setting-keys";

type SettingData = {
  key: string;
  value: number | boolean | string;
};

export function SettingsManager({ initialSettings }: { initialSettings: SettingData[] }) {
  const [pending, startTransition] = useTransition();

  // Create local states based on initialSettings mapping
  const getSettingValue = (key: string, fallback: number | boolean | string) => {
    const s = initialSettings.find((x) => x.key === key);
    return s !== undefined ? s.value : fallback;
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

  const [reminderAutoEnabled, setReminderAutoEnabled] = useState(!!getSettingValue(SETTING_KEYS.reminderAutoEnabled, false));
  const [reminderSendHour, setReminderSendHour] = useState(
    String(getSettingValue(SETTING_KEYS.reminderSendHour, DEFAULT_REMINDER_SEND_HOUR)),
  );
  const [reminderCooldownHours, setReminderCooldownHours] = useState(
    String(getSettingValue(SETTING_KEYS.reminderCooldownHours, DEFAULT_REMINDER_COOLDOWN_HOURS)),
  );
  const [reminderMessageTemplate, setReminderMessageTemplate] = useState(
    String(getSettingValue(SETTING_KEYS.reminderMessageTemplate, DEFAULT_REMINDER_MESSAGE_TEMPLATE)),
  );

  const handleSave = () => {
    startTransition(async () => {
      const settings = {
        [SETTING_KEYS.calibrationThreshold]: Number(calibrationThreshold),
        [SETTING_KEYS.damenEnabled]: damenEnabled,
        [SETTING_KEYS.temuAbsenceThreshold]: Number(temuAbsenceThreshold),
        [SETTING_KEYS.temuOfflineAbsenceThreshold]: Number(temuOfflineAbsenceThreshold),
        [SETTING_KEYS.dataInsufficientMessage]: dataInsufficientMessage,
        [SETTING_KEYS.reminderAutoEnabled]: reminderAutoEnabled,
        [SETTING_KEYS.reminderSendHour]: Number(reminderSendHour),
        [SETTING_KEYS.reminderCooldownHours]: Number(reminderCooldownHours),
        [SETTING_KEYS.reminderMessageTemplate]: reminderMessageTemplate,
      };

      const res = await updateSettingsAction(settings);
      if (res.ok) {
        toast.success("Konfigurasi berhasil disimpan.");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Kalibrasi & Verifikasi</h3>
          <p className="text-xs text-muted-foreground">Ambang deviasi penilaian mentor dan struktur lapis verifikasi kelulusan.</p>
        </div>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Simpan Konfigurasi
        </Button>
      </div>

      <div className="grid gap-6 text-xs">
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
              Tombol kirim manual selalu tersedia di halaman Tracking Unit. Pengaturan di bawah ini hanya mengendalikan reminder{" "}
              <span className="font-semibold">otomatis</span> (cron berjalan tiap jam, tapi baru benar-benar mengirim sesuai jadwal
              di bawah).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2 justify-center items-start border rounded-lg p-3 bg-muted/20 md:col-span-2">
              <div className="flex items-center justify-between w-full">
                <Label htmlFor="reminder-auto-toggle" className="font-semibold cursor-pointer">Reminder Otomatis Aktif</Label>
                <Switch id="reminder-auto-toggle" checked={reminderAutoEnabled} onCheckedChange={setReminderAutoEnabled} />
              </div>
              <span className="text-[10px] text-muted-foreground">
                Jika aktif, sistem otomatis mengirim WA ke mentor unit yang presensi/nilainya belum 100% lengkap, sesuai jam &amp;
                jeda di bawah. Jika nonaktif, hanya tombol manual yang bisa mengirim.
              </span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reminder-send-hour">Jam Kirim (WIB, 0-23)</Label>
              <Input
                id="reminder-send-hour"
                type="number"
                min="0"
                max="23"
                step="1"
                value={reminderSendHour}
                onChange={(e) => setReminderSendHour(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">Jam berapa (waktu Indonesia Barat) reminder otomatis dikirim setiap harinya (default: 08).</span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reminder-cooldown">Jeda Minimal per Unit (jam)</Label>
              <Input
                id="reminder-cooldown"
                type="number"
                min="1"
                step="1"
                value={reminderCooldownHours}
                onChange={(e) => setReminderCooldownHours(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">
                Unit yang sama tidak diingatkan otomatis lagi sebelum jeda ini terlewati (default: 24 jam = maksimal sekali sehari).
              </span>
            </div>
            <div className="grid gap-1.5 md:col-span-2">
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
