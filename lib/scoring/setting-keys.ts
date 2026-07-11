/**
 * Deliberately has NO `import "server-only"` guard, unlike calculate.ts —
 * prisma/seed.ts needs these exact key strings too, and it runs via plain
 * `tsx` outside Next.js's bundler, where `server-only` throws on import.
 * Keep this file to pure constants only, nothing DB/request-related.
 */
export const SETTING_KEYS = {
  attendancePersonal: "weights.attendance.personal",
  attendanceSkill: "weights.attendance.skill",
  logbookPersonal: "weights.logbook.personal",
  logbookSkill: "weights.logbook.skill",
  k1Skill: "weights.k1.skill",
  k2Skill: "weights.k2.skill",
  calibrationThreshold: "calibration.deviationThreshold",
  damenEnabled: "verification.damenEnabled",
  marsPassThreshold: "mars.passThreshold",
} as const;
