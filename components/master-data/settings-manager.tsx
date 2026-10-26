"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, AlertCircle, MessageSquare, CheckSquare } from "lucide-react";
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
  DEFAULT_KEGIATAN_BESAR_ABSENCE_THRESHOLD,
  DEFAULT_DATA_INSUFFICIENT_MESSAGE,
  DEFAULT_BROADCAST_REMINDER_TEMPLATE,
  DEFAULT_BROADCAST_THANK_YOU_TEMPLATE,
  DEFAULT_ATTENDANCE_STATUS_SCORES,
  DEFAULT_PARTICIPATION_MAPPING,
  DEFAULT_PERSONAL_COMPONENT_WEIGHTS,
  DEFAULT_SKILL_COMPONENT_WEIGHTS,
  DEFAULT_PREDICATE_THRESHOLDS,
  DEFAULT_RAPORT_THANK_YOU_MESSAGE,
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

const PERSONAL_WEIGHT_FIELDS = [
  { key: "temuFteic", label: "Kehadiran Temu FTEIC" },
  { key: "kegiatanBesar", label: "Kehadiran Kegiatan Besar" },
  { key: "inclenation", label: "Kehadiran Inclenation" },
  { key: "materi", label: "Penilaian Materi" },
];

const PREDICATE_FIELDS = [
  { key: "sangatBaik", label: "Sangat Baik ≥" },
  { key: "baik", label: "Baik ≥" },
  { key: "cukup", label: "Cukup ≥ (di bawahnya Kurang)" },
];

const SKILL_WEIGHT_FIELDS = [
  { key: "kegiatan", label: "Kegiatan Keahlian" },
  { key: "mentor", label: "Evaluasi Mentor" },
];

function PlaceholderList({ names }: { names: string[] }) {
  return (
    <>
      {names.map((name) => (
        <code key={name} className="mr-1 font-mono">{`{{${name}}}`}</code>
      ))}
    </>
  );
}

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
  const [kegiatanBesarAbsenceThreshold, setKegiatanBesarAbsenceThreshold] = useState(
    String(getSettingValue(SETTING_KEYS.kegiatanBesarAbsenceThreshold, DEFAULT_KEGIATAN_BESAR_ABSENCE_THRESHOLD)),
  );
  const [dataInsufficientMessage, setDataInsufficientMessage] = useState(
    String(getSettingValue(SETTING_KEYS.dataInsufficientMessage, DEFAULT_DATA_INSUFFICIENT_MESSAGE)),
  );

  const [broadcastFeedbackUrl, setBroadcastFeedbackUrl] = useState(String(getSettingValue(SETTING_KEYS.broadcastFeedbackUrl, "")));
  const [broadcastReminderTemplate, setBroadcastReminderTemplate] = useState(
    String(getSettingValue(SETTING_KEYS.broadcastReminderTemplate, DEFAULT_BROADCAST_REMINDER_TEMPLATE)),
  );
  const [broadcastThankYouTemplate, setBroadcastThankYouTemplate] = useState(
    String(getSettingValue(SETTING_KEYS.broadcastThankYouTemplate, DEFAULT_BROADCAST_THANK_YOU_TEMPLATE)),
  );

  // Attendance Status Scores State
  const initialStatusScores = getSettingValue(SETTING_KEYS.attendanceStatusScores, DEFAULT_ATTENDANCE_STATUS_SCORES);
  const [hadirScore, setHadirScore] = useState(String(initialStatusScores.HADIR ?? 100));
  const [izinScore, setIzinScore] = useState(String(initialStatusScores.IZIN ?? 50));
  const [alpaScore, setAlpaScore] = useState(String(initialStatusScores.ALPA ?? 0));

  // Nilai Personal / Keahlian component weights (see calculate.ts)
  const initialPersonalWeights = { ...DEFAULT_PERSONAL_COMPONENT_WEIGHTS, ...getSettingValue(SETTING_KEYS.personalComponentWeights, {}) };
  const [personalWeights, setPersonalWeights] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialPersonalWeights).map(([k, v]) => [k, String(v)])),
  );
  const [raportThankYou, setRaportThankYou] = useState(
    String(getSettingValue(SETTING_KEYS.raportThankYouMessage, DEFAULT_RAPORT_THANK_YOU_MESSAGE)),
  );
  // Rekap: predikat bands for the pie charts
  const initialThresholds = { ...DEFAULT_PREDICATE_THRESHOLDS, ...getSettingValue(SETTING_KEYS.recapPredicateThresholds, {}) };
  const [thresholds, setThresholds] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialThresholds).map(([k, v]) => [k, String(v)])),
  );

  const initialSkillWeights = { ...DEFAULT_SKILL_COMPONENT_WEIGHTS, ...getSettingValue(SETTING_KEYS.skillComponentWeights, {}) };
  const [skillWeights, setSkillWeights] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialSkillWeights).map(([k, v]) => [k, String(v)])),
  );

  // Participation Mapping State: Record<sessionCode, subCode[]> (DEFAULT is fallback for regular sessions)
  const initialPartMapping = getSettingValue(SETTING_KEYS.participationMapping, DEFAULT_PARTICIPATION_MAPPING);
  const [participationMapping, setParticipationMapping] = useState<Record<string, string[]>>(initialPartMapping);

  const handleTogglePartMapping = (sessionCode: string, subCode: string) => {
    setParticipationMapping((prev) => {
      const current = prev[sessionCode] || [];
      const updated = current.includes(subCode) ? current.filter((x) => x !== subCode) : [...current, subCode];
      return { ...prev, [sessionCode]: updated };
    });
  };

  const handleSave = () => {
    const feedbackUrl = broadcastFeedbackUrl.trim();
    if (feedbackUrl && !/^https?:\/\/\S+$/i.test(feedbackUrl)) {
      toast.error("Link feedback harus diawali http:// atau https:// dan tidak boleh mengandung spasi.");
      return;
    }

    startTransition(async () => {
      const settings = {
        [SETTING_KEYS.calibrationThreshold]: Number(calibrationThreshold),
        [SETTING_KEYS.damenEnabled]: damenEnabled,
        [SETTING_KEYS.temuAbsenceThreshold]: Number(temuAbsenceThreshold),
        [SETTING_KEYS.kegiatanBesarAbsenceThreshold]: Number(kegiatanBesarAbsenceThreshold),
        [SETTING_KEYS.dataInsufficientMessage]: dataInsufficientMessage,
        // A blank template would silently fall back to the default at send time
        // while this form showed it empty — store the default so both agree.
        [SETTING_KEYS.broadcastReminderTemplate]: broadcastReminderTemplate.trim() ? broadcastReminderTemplate : DEFAULT_BROADCAST_REMINDER_TEMPLATE,
        [SETTING_KEYS.broadcastThankYouTemplate]: broadcastThankYouTemplate.trim() ? broadcastThankYouTemplate : DEFAULT_BROADCAST_THANK_YOU_TEMPLATE,
        [SETTING_KEYS.broadcastFeedbackUrl]: feedbackUrl,
        [SETTING_KEYS.attendanceStatusScores]: {
          HADIR: Number(hadirScore),
          IZIN: Number(izinScore),
          ALPA: Number(alpaScore),
        },
        [SETTING_KEYS.participationMapping]: participationMapping,
        [SETTING_KEYS.personalComponentWeights]: Object.fromEntries(Object.entries(personalWeights).map(([k, v]) => [k, Number(v)])),
        [SETTING_KEYS.skillComponentWeights]: Object.fromEntries(Object.entries(skillWeights).map(([k, v]) => [k, Number(v)])),
        [SETTING_KEYS.raportThankYouMessage]: raportThankYou.trim() ? raportThankYou : DEFAULT_RAPORT_THANK_YOU_MESSAGE,
        [SETTING_KEYS.recapPredicateThresholds]: Object.fromEntries(Object.entries(thresholds).map(([k, v]) => [k, Number(v)])),
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

            {/* Component weights */}
            <div className="space-y-3 pt-2">
              <h4 className="font-semibold text-xs text-foreground">2. Bobot Komponen Nilai</h4>
              <p className="text-[10px] text-muted-foreground">
                Nilai Personal = gabungan berbobot kehadiran (objektif) dan Penilaian Materi dari mentor/kuis. Komponen yang belum
                punya data otomatis tidak dihitung dan bobot sisanya dinormalisasi ulang.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PERSONAL_WEIGHT_FIELDS.map((f) => (
                  <div key={f.key} className="grid gap-1 rounded-lg border bg-background p-2">
                    <Label htmlFor={`pw-${f.key}`} className="text-[11px] font-medium">{f.label}</Label>
                    <Input
                      id={`pw-${f.key}`}
                      type="number"
                      step="0.05"
                      min="0"
                      value={personalWeights[f.key] ?? ""}
                      onChange={(e) => setPersonalWeights((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="h-7 text-xs font-mono font-bold"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Nilai Keahlian per kategori: evaluasi mentor digabung dengan Kegiatan Keahlian — ikut minimal 1 kegiatan di
                kategori itu = porsi kegiatan 100, tidak ikut = 0 (berlaku setelah kategori itu punya kegiatan).
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SKILL_WEIGHT_FIELDS.map((f) => (
                  <div key={f.key} className="grid gap-1 rounded-lg border bg-background p-2">
                    <Label htmlFor={`sw-${f.key}`} className="text-[11px] font-medium">{f.label}</Label>
                    <Input
                      id={`sw-${f.key}`}
                      type="number"
                      step="0.05"
                      min="0"
                      value={skillWeights[f.key] ?? ""}
                      onChange={(e) => setSkillWeights((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="h-7 text-xs font-mono font-bold"
                    />
                  </div>
                ))}
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
              Gate Presensi (&ldquo;Tidak Dapat Diagregasi&rdquo;)
            </CardTitle>
            <CardDescription className="text-[10px]">
              Maba yang melampaui salah satu ambang ini tetap tampil nilainya di raport, tapi statusnya berubah menjadi &ldquo;Tidak Dapat
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
              <span className="text-[10px] text-muted-foreground">Jumlah absen (izin/alpa) di seluruh sesi Temu FTEIC sebelum gate aktif (default: 2). Temu FTEIC 2 (kuis) dihitung hadir bila nilainya ada &gt; 0.</span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="besar-absence-thresh">Ambang Absen Kegiatan Besar (lebih dari)</Label>
              <Input
                id="besar-absence-thresh"
                type="number"
                min="0"
                step="1"
                value={kegiatanBesarAbsenceThreshold}
                onChange={(e) => setKegiatanBesarAbsenceThreshold(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">Jumlah absen (izin/alpa) di Pesraf/Soscom/Arus Emas 1-3/Compex sebelum gate aktif (default: 2 → wajib hadir 4 dari 6).</span>
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

        {/* Raport PDF maba */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              Raport PDF Maba
            </CardTitle>
            <CardDescription className="text-[10px]">
              Paragraf penutup / ucapan terima kasih pada PDF raport yang diunduh maba dari halaman Cek Raport.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="raport-thank-you">Ucapan Terima Kasih</Label>
              <Button type="button" size="xs" variant="ghost" onClick={() => setRaportThankYou(DEFAULT_RAPORT_THANK_YOU_MESSAGE)}>
                Pakai teks bawaan
              </Button>
            </div>
            <Textarea id="raport-thank-you" value={raportThankYou} onChange={(e) => setRaportThankYou(e.target.value)} rows={5} />
          </CardContent>
        </Card>

        {/* Rekap Nilai: batas predikat */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="size-4 text-primary" />
              Rekap Nilai: Batas Predikat
            </CardTitle>
            <CardDescription className="text-[10px]">
              Batas predikat dipakai diagram lingkaran di halaman Rekap Nilai dan Excel-nya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {PREDICATE_FIELDS.map((f) => (
                <div key={f.key} className="grid gap-1 rounded-lg border p-2">
                  <Label htmlFor={`pred-${f.key}`} className="text-[11px] font-medium">{f.label}</Label>
                  <Input
                    id={`pred-${f.key}`}
                    type="number"
                    min="0"
                    max="100"
                    value={thresholds[f.key] ?? ""}
                    onChange={(e) => setThresholds((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="h-7 text-xs font-mono font-bold"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Broadcast WhatsApp (BC) ke Mentor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              Broadcast WhatsApp (BC) ke Mentor
            </CardTitle>
            <CardDescription className="text-[10px]">
              Dipakai di halaman Tracking Unit: tombol &ldquo;BC Reminder&rdquo; (unit belum lengkap) dan &ldquo;BC Terima
              Kasih&rdquo; (unit sudah lengkap) membuka WhatsApp dengan pesan siap kirim — admin yang menekan kirim secara manual.
              Daftar kegiatan yang belum lengkap diambil otomatis dari checklist yang sama dengan halaman Cek Unit.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="broadcast-feedback-url">Link Feedback (untuk BC Terima Kasih)</Label>
              <Input
                id="broadcast-feedback-url"
                type="url"
                inputMode="url"
                placeholder="https://forms.gle/..."
                value={broadcastFeedbackUrl}
                onChange={(e) => setBroadcastFeedbackUrl(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">
                Masuk ke placeholder <code className="font-mono">{"{{feedbackUrl}}"}</code> pada template terima kasih. Kosongkan bila
                belum ada — paragraf yang memuat placeholder kosong otomatis dihilangkan dari pesan.
              </span>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="broadcast-reminder-template">Template BC Reminder (unit belum lengkap)</Label>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setBroadcastReminderTemplate(DEFAULT_BROADCAST_REMINDER_TEMPLATE)}
                >
                  Pakai template bawaan
                </Button>
              </div>
              <Textarea
                id="broadcast-reminder-template"
                value={broadcastReminderTemplate}
                onChange={(e) => setBroadcastReminderTemplate(e.target.value)}
                rows={8}
              />
              <span className="text-[10px] text-muted-foreground">
                Placeholder: <PlaceholderList names={["mentorName", "unitCode", "unitName", "pct", "incompleteCount", "incompleteList"]} />
                — <code className="font-mono">{"{{incompleteList}}"}</code> berisi daftar kegiatan beserta item yang belum lengkap.
              </span>
              {!broadcastReminderTemplate.includes("{{incompleteList}}") ? (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  Template ini tidak memuat <code className="font-mono">{"{{incompleteList}}"}</code>, jadi rincian kegiatan yang
                  belum lengkap tidak akan muncul di pesan.
                </span>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="broadcast-thank-you-template">Template BC Terima Kasih (unit sudah lengkap)</Label>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setBroadcastThankYouTemplate(DEFAULT_BROADCAST_THANK_YOU_TEMPLATE)}
                >
                  Pakai template bawaan
                </Button>
              </div>
              <Textarea
                id="broadcast-thank-you-template"
                value={broadcastThankYouTemplate}
                onChange={(e) => setBroadcastThankYouTemplate(e.target.value)}
                rows={8}
              />
              <span className="text-[10px] text-muted-foreground">
                Placeholder: <PlaceholderList names={["mentorName", "unitCode", "unitName", "pct", "feedbackUrl"]} />
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
