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
  reminderAutoEnabled: "reminder.autoEnabled",
  reminderSendHour: "reminder.sendHour",
  reminderCooldownHours: "reminder.cooldownHours",
  reminderMessageTemplate: "reminder.messageTemplate",
} as const;

export const DEFAULT_TEMU_ABSENCE_THRESHOLD = 2;
export const DEFAULT_TEMU_OFFLINE_ABSENCE_THRESHOLD = 1;
export const DEFAULT_DATA_INSUFFICIENT_MESSAGE =
  "Data Anda tidak dapat diagregasi karena kekurangan kehadiran dan nilai, sehingga tidak masuk ke dalam pengolahan. Seluruh data pengembangan Anda akan diberikan kepada HMD untuk pengembangan lebih lanjut.";

/// Local hour (Asia/Jakarta, 0-23) the automatic reminder cron is allowed to
/// actually send at — the cron itself fires hourly (see vercel.json), this
/// is the gate that makes it fire only once a day at an admin-chosen time.
export const DEFAULT_REMINDER_SEND_HOUR = 8;
/// Minimum gap before the SAME unit can be auto-reminded again, so a unit
/// that stays incomplete for days doesn't get a WA blast every single hour
/// the cron fires. Manual sends (the button in Tracking Unit) ignore this —
/// an admin clicking the button is an explicit, intentional send.
export const DEFAULT_REMINDER_COOLDOWN_HOURS = 24;
export const DEFAULT_REMINDER_MESSAGE_TEMPLATE =
  "Halo {{mentorName}}, ini pengingat dari PSDM: presensi & pengisian nilai Unit {{unitCode}} ({{unitName}}) belum lengkap. Progres saat ini — Presensi: {{attPct}}%, Nilai: {{scorePct}}%. Mohon segera dilengkapi di Portal Gradaks. Terima kasih.";
