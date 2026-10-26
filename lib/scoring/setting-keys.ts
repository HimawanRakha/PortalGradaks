/**
 * Deliberately has NO `import "server-only"` guard, unlike calculate.ts —
 * prisma/seed.ts needs these exact key strings too, and it runs via plain
 * `tsx` outside Next.js's bundler, where `server-only` throws on import.
 * Keep this file to pure constants only, nothing DB/request-related.
 */
export const SETTING_KEYS = {
  calibrationThreshold: "calibration.deviationThreshold",
  damenEnabled: "verification.damenEnabled",
  temuAbsenceThreshold: "attendance.temuAbsenceThreshold",
  kegiatanBesarAbsenceThreshold: "attendance.kegiatanBesarAbsenceThreshold",
  dataInsufficientMessage: "attendance.dataInsufficientMessage",
  broadcastReminderTemplate: "broadcast.reminderTemplate",
  broadcastThankYouTemplate: "broadcast.thankYouTemplate",
  broadcastFeedbackUrl: "broadcast.feedbackUrl",
  attendanceStatusScores: "attendance.statusScores",
  participationMapping: "attendance.participationMapping",
  personalComponentWeights: "weights.personalComponents",
  recapPredicateThresholds: "recap.predicateThresholds",
  raportThankYouMessage: "raport.thankYouMessage",
  skillComponentWeights: "weights.skillComponents",
} as const;

export const DEFAULT_TEMU_ABSENCE_THRESHOLD = 2;
export const DEFAULT_KEGIATAN_BESAR_ABSENCE_THRESHOLD = 2;
export const DEFAULT_DATA_INSUFFICIENT_MESSAGE =
  "Data Anda tidak dapat diagregasi karena kekurangan kehadiran dan nilai, sehingga tidak masuk ke dalam pengolahan. Seluruh data pengembangan Anda akan diberikan kepada HMD untuk pengembangan lebih lanjut.";

/**
 * Templates for the manual WhatsApp broadcasts (BC) PSDM sends to mentors
 * from the Tracking Unit page — see lib/broadcast/message.ts for the
 * placeholder list and the "paragraph with an empty placeholder is dropped"
 * rule. The reminder body mirrors the public /cek-unit "Chat Reminder" so a
 * mentor sees the same shape of message from either route.
 */
export const DEFAULT_BROADCAST_REMINDER_TEMPLATE =
  "Halo Kak {{mentorName}}, izin mengingatkan dari PSDM BEM FTEIC (Portal Gradaks) 🙏\n\n" +
  "Status kelengkapan nilai Unit {{unitName}} ({{unitCode}}) saat ini {{pct}}%. Berikut yang masih belum lengkap diinput:\n\n" +
  "{{incompleteList}}\n\n" +
  "Mohon bantuannya ya Kak agar nilai unit kita 100% lengkap. Terima kasih Kak! 🙏";

export const DEFAULT_BROADCAST_THANK_YOU_TEMPLATE =
  "Halo Kak {{mentorName}}, salam dari PSDM BEM FTEIC (Portal Gradaks) 👋\n\n" +
  "Terima kasih banyak ya Kak 🙏 Seluruh presensi dan penilaian Unit {{unitName}} ({{unitCode}}) dari kegiatan yang sudah berjalan sudah lengkap diinput. Kami sangat mengapresiasi dedikasi Kakak dalam mendampingi maba.\n\n" +
  "Agar GRADAKS ke depan bisa lebih baik, mohon kesediaan Kakak mengisi feedback singkat lewat link berikut:\n{{feedbackUrl}}\n\n" +
  "Sekali lagi, terima kasih atas waktu dan bantuannya Kak! 🙏";

export const DEFAULT_ATTENDANCE_STATUS_SCORES = {
  HADIR: 100,
  IZIN: 50,
  ALPA: 0,
};

export const DEFAULT_PARTICIPATION_MAPPING: Record<string, string[]> = {
  DEFAULT: ["B.2", "C.1"],
};

/**
 * Nilai Personal = weighted blend of the three objective attendance sections
 * and the (more subjective) mentor/quiz materi score — attendance dominates
 * on purpose so a maba who skips activities can't be carried by mentor
 * rubric scores alone. A component with no held sessions yet is dropped and
 * the rest re-normalized (see calculate.ts).
 */
export const DEFAULT_PERSONAL_COMPONENT_WEIGHTS = {
  temuFteic: 0.25,
  kegiatanBesar: 0.25,
  inclenation: 0.1,
  materi: 0.4,
};

/**
 * Per Nilai Keahlian category: mentor logbook evaluation blended with
 * Kegiatan Keahlian — joining ≥1 kegiatan in the category scores 100 for the
 * kegiatan half, joining none scores 0 (once that category has any kegiatan).
 */
export const DEFAULT_SKILL_COMPONENT_WEIGHTS = {
  kegiatan: 0.2,
  mentor: 0.8,
};

/**
 * Predikat bands for the recap pie charts: score >= sangatBaik → Sangat Baik,
 * >= baik → Baik, >= cukup → Cukup, otherwise Kurang (0-100 scale).
 */
export const DEFAULT_PREDICATE_THRESHOLDS = {
  sangatBaik: 85,
  baik: 70,
  cukup: 55,
};

/** Every aspect the recap maps into predikat pies, in display order. */
export const RECAP_ASPECTS: Array<{ code: string; label: string; group: string }> = [
  { code: "A.1", label: "Kebersamaan", group: "Sub-Nilai Personal" },
  { code: "A.2", label: "Kebanggaan Fakultas", group: "Sub-Nilai Personal" },
  { code: "B.1", label: "Manajemen Diri", group: "Sub-Nilai Personal" },
  { code: "B.2", label: "Kerja Sama", group: "Sub-Nilai Personal" },
  { code: "C.1", label: "Problem Solving", group: "Sub-Nilai Personal" },
  { code: "C.2", label: "Kepekaan Sosial", group: "Sub-Nilai Personal" },
  { code: "M", label: "Manajerial", group: "Keahlian" },
  { code: "K", label: "Keilmiahan", group: "Keahlian" },
  { code: "MB", label: "Minat Bakat", group: "Keahlian" },
  { code: "KW", label: "Kewirausahaan", group: "Keahlian" },
  { code: "TEMU_FTEIC", label: "Kehadiran Temu FTEIC", group: "Kehadiran" },
  { code: "KEGIATAN_BESAR", label: "Kehadiran Kegiatan Besar", group: "Kehadiran" },
  { code: "INCLENATION", label: "Kehadiran Inclenation", group: "Kehadiran" },
];

/** Closing paragraph on the maba's downloadable PDF raport — editable in Settings. */
export const DEFAULT_RAPORT_THANK_YOU_MESSAGE =
  "Terima kasih atas partisipasi dan semangat Anda selama rangkaian GRADAKS 2026. Raport ini merangkum perjalanan " +
  "pengembangan Anda, mulai dari kehadiran, keaktifan, hingga penilaian materi, sebagai bahan refleksi untuk terus " +
  "bertumbuh. Seluruh data pengembangan Anda juga diteruskan kepada Himpunan Mahasiswa Departemen (HMD) sebagai bekal " +
  "pendampingan selanjutnya. Selamat berproses dan terus berkontribusi untuk FTEIC!";
