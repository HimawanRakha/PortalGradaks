"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, Scale3d, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { updateSettingsAction } from "@/app/(dashboard)/admin/master-data/actions";
import { SETTING_KEYS } from "@/lib/scoring/setting-keys";

type SettingData = {
  key: string;
  value: number | boolean;
};

export function SettingsManager({ initialSettings }: { initialSettings: SettingData[] }) {
  const [pending, startTransition] = useTransition();

  // Create local states based on initialSettings mapping
  const getSettingValue = (key: string, fallback: number | boolean) => {
    const s = initialSettings.find((x) => x.key === key);
    return s !== undefined ? s.value : fallback;
  };

  const [attendancePersonal, setAttendancePersonal] = useState(String(getSettingValue(SETTING_KEYS.attendancePersonal, 0.1)));
  const [attendanceSkill, setAttendanceSkill] = useState(String(getSettingValue(SETTING_KEYS.attendanceSkill, 0.1)));
  const [logbookPersonal, setLogbookPersonal] = useState(String(getSettingValue(SETTING_KEYS.logbookPersonal, 0.15)));
  const [logbookSkill, setLogbookSkill] = useState(String(getSettingValue(SETTING_KEYS.logbookSkill, 0.1)));
  const [k1Skill, setK1Skill] = useState(String(getSettingValue(SETTING_KEYS.k1Skill, 0.05)));
  const [k2Skill, setK2Skill] = useState(String(getSettingValue(SETTING_KEYS.k2Skill, 0.1)));
  const [calibrationThreshold, setCalibrationThreshold] = useState(String(getSettingValue(SETTING_KEYS.calibrationThreshold, 0.6)));
  const [marsPassThreshold, setMarsPassThreshold] = useState(String(getSettingValue(SETTING_KEYS.marsPassThreshold, 70)));
  const [damenEnabled, setDamenEnabled] = useState(!!getSettingValue(SETTING_KEYS.damenEnabled, false));

  const handleSave = () => {
    startTransition(async () => {
      const settings = {
        [SETTING_KEYS.attendancePersonal]: Number(attendancePersonal),
        [SETTING_KEYS.attendanceSkill]: Number(attendanceSkill),
        [SETTING_KEYS.logbookPersonal]: Number(logbookPersonal),
        [SETTING_KEYS.logbookSkill]: Number(logbookSkill),
        [SETTING_KEYS.k1Skill]: Number(k1Skill),
        [SETTING_KEYS.k2Skill]: Number(k2Skill),
        [SETTING_KEYS.calibrationThreshold]: Number(calibrationThreshold),
        [SETTING_KEYS.marsPassThreshold]: Number(marsPassThreshold),
        [SETTING_KEYS.damenEnabled]: damenEnabled,
      };

      const res = await updateSettingsAction(settings);
      if (res.ok) {
        toast.success("Konfigurasi bobot dan parameter berhasil disimpan.");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Bobot Nilai & Parameter Evaluasi</h3>
          <p className="text-xs text-muted-foreground">Sesuaikan proporsi kontribusi nilai personal/keahlian dan threshold kelulusan.</p>
        </div>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Simpan Konfigurasi
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 text-xs">
        {/* Personal Score Weights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Scale3d className="size-4 text-primary" />
              Bobot Raport — Nilai Personal
            </CardTitle>
            <CardDescription className="text-[10px]">
              Bobot evaluasi kebiasaan, kepatuhan, dan komitmen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="att-personal">Bobot Sesi Kehadiran & Keaktifan (Attendance)</Label>
              <Input
                id="att-personal"
                type="number"
                step="0.01"
                value={attendancePersonal}
                onChange={(e) => setAttendancePersonal(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">Kontribusi presensi harian terhadap Nilai Personal.</span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="log-personal">Bobot Kelengkapan Logbook Kegiatan</Label>
              <Input
                id="log-personal"
                type="number"
                step="0.01"
                value={logbookPersonal}
                onChange={(e) => setLogbookPersonal(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">Kontribusi pengisian logbook (rasio LENGKAP) terhadap Nilai Personal.</span>
            </div>
          </CardContent>
        </Card>

        {/* Skill Score Weights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Scale3d className="size-4 text-primary" />
              Bobot Raport — Nilai Keahlian
            </CardTitle>
            <CardDescription className="text-[10px]">
              Bobot evaluasi penguasaan materi, pemecahan masalah, dan penugasan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="att-skill">Bobot Sesi Kehadiran & Keaktifan (Attendance)</Label>
              <Input
                id="att-skill"
                type="number"
                step="0.01"
                value={attendanceSkill}
                onChange={(e) => setAttendanceSkill(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="log-skill">Bobot Kelengkapan Logbook Kegiatan</Label>
              <Input
                id="log-skill"
                type="number"
                step="0.01"
                value={logbookSkill}
                onChange={(e) => setLogbookSkill(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="k1-skill">Bobot Kuesioner K1</Label>
                <Input
                  id="k1-skill"
                  type="number"
                  step="0.01"
                  value={k1Skill}
                  onChange={(e) => setK1Skill(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="k2-skill">Bobot Kuesioner K2</Label>
                <Input
                  id="k2-skill"
                  type="number"
                  step="0.01"
                  value={k2Skill}
                  onChange={(e) => setK2Skill(e.target.value)}
                  className="h-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calibration & Thresholds */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="size-4 text-primary" />
              Kalibrasi, Verifikasi, & Ambang Batas Kelulusan
            </CardTitle>
            <CardDescription className="text-[10px]">
              Parameter deteksi penyimpangan dan penguncian verifikasi akhir.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-3">
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

            <div className="grid gap-1.5">
              <Label htmlFor="mars-thresh">Ambang Batas Kelulusan Mars Electics (Nilai)</Label>
              <Input
                id="mars-thresh"
                type="number"
                value={marsPassThreshold}
                onChange={(e) => setMarsPassThreshold(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">Skor minimal (0-100) untuk dinyatakan LULUS tes Mars Electics.</span>
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
      </div>
    </div>
  );
}
