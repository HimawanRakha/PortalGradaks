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
} as const;

export const DEFAULT_TEMU_ABSENCE_THRESHOLD = 2;
export const DEFAULT_TEMU_OFFLINE_ABSENCE_THRESHOLD = 1;
export const DEFAULT_DATA_INSUFFICIENT_MESSAGE =
  "Data Anda tidak dapat diagregasi karena kekurangan kehadiran dan nilai, sehingga tidak masuk ke dalam pengolahan. Seluruh data pengembangan Anda akan diberikan kepada HMD untuk pengembangan lebih lanjut.";
