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
  reminderMessageTemplate: "reminder.messageTemplate",
  attendanceStatusScores: "attendance.statusScores",
  attendanceMapping: "attendance.mapping",
} as const;

export const DEFAULT_TEMU_ABSENCE_THRESHOLD = 2;
export const DEFAULT_TEMU_OFFLINE_ABSENCE_THRESHOLD = 1;
export const DEFAULT_DATA_INSUFFICIENT_MESSAGE =
  "Data Anda tidak dapat diagregasi karena kekurangan kehadiran dan nilai, sehingga tidak masuk ke dalam pengolahan. Seluruh data pengembangan Anda akan diberikan kepada HMD untuk pengembangan lebih lanjut.";

export const DEFAULT_REMINDER_MESSAGE_TEMPLATE =
  "Halo {{mentorName}}, ini pengingat dari PSDM: presensi & pengisian nilai Unit {{unitCode}} ({{unitName}}) belum lengkap. Progres saat ini — Presensi: {{attPct}}%, Nilai: {{scorePct}}%. Mohon segera dilengkapi di Portal Gradaks. Terima kasih.";

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
