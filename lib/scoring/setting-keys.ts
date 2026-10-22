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
  temuOfflineAbsenceThreshold: "attendance.temuOfflineAbsenceThreshold",
  dataInsufficientMessage: "attendance.dataInsufficientMessage",
  broadcastReminderTemplate: "broadcast.reminderTemplate",
  broadcastThankYouTemplate: "broadcast.thankYouTemplate",
  broadcastFeedbackUrl: "broadcast.feedbackUrl",
  attendanceStatusScores: "attendance.statusScores",
  attendanceMapping: "attendance.mapping",
  participationMapping: "attendance.participationMapping",
} as const;

export const DEFAULT_TEMU_ABSENCE_THRESHOLD = 2;
export const DEFAULT_TEMU_OFFLINE_ABSENCE_THRESHOLD = 1;
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

export const DEFAULT_ATTENDANCE_MAPPING: Record<string, string[]> = {
  PESRAF: ["A.1"],
  DIESNAT: ["A.2"],
  ARUS_EMAS: ["A.1", "A.2"],
  SOSCOM: ["A.1", "B.2", "C.2"],
  COMPANY_EXPO: ["B.1", "C.2"],
  COMPEX: ["B.1", "C.2"],
};

export const DEFAULT_PARTICIPATION_MAPPING: Record<string, string[]> = {
  DEFAULT: ["B.2", "C.1"],
};
