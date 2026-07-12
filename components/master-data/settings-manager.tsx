"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, AlertCircle } from "lucide-react";
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

  const [calibrationThreshold, setCalibrationThreshold] = useState(String(getSettingValue(SETTING_KEYS.calibrationThreshold, 0.6)));
  const [damenEnabled, setDamenEnabled] = useState(!!getSettingValue(SETTING_KEYS.damenEnabled, false));

  const handleSave = () => {
    startTransition(async () => {
      const settings = {
        [SETTING_KEYS.calibrationThreshold]: Number(calibrationThreshold),
        [SETTING_KEYS.damenEnabled]: damenEnabled,
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
      </div>
    </div>
  );
}
