/**
 * Deliberately has NO `import "server-only"` guard, unlike calculate.ts —
 * prisma/seed.ts needs these exact key strings too, and it runs via plain
 * `tsx` outside Next.js's bundler, where `server-only` throws on import.
 * Keep this file to pure constants only, nothing DB/request-related.
 */
export const SETTING_KEYS = {
  calibrationThreshold: "calibration.deviationThreshold",
  damenEnabled: "verification.damenEnabled",
} as const;
