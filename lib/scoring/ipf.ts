import { AttendanceCategory } from "@/app/generated/prisma/enums";
import type { ComputedScores } from "./calculate";

/**
 * Kelulusan IPF (Inclenation). The official result is the list PSDM decides
 * (Setting "raport.ipfFailedNrps": NRPs that did NOT pass) — some cases are
 * judgement calls the attendance rule alone can't make. Only while that list
 * has not been configured does the attendance rule below act as a fallback:
 *   1. Hadir both Inclenation days                      -> lulus.
 *   2./3. Otherwise (izin/alpa on one or both days)     -> lulus as long as they
 *      kept joining Temu FTEIC (alpa within the Temu FTEIC absence limit).
 */
export type IpfStatus = { passed: boolean; source: "LIST" | "RULE" };

export function ipfStatus(computed: ComputedScores, nrp: string, failedNrps: Set<string> | null): IpfStatus {
  if (failedNrps) return { passed: !failedNrps.has(nrp.trim()), source: "LIST" };
  const incl = computed.attendance.find((s) => s.category === AttendanceCategory.INCLENATION);
  const temu = computed.attendance.find((s) => s.category === AttendanceCategory.TEMU_FTEIC);
  if (incl && incl.heldCount > 0 && incl.attendedCount >= incl.heldCount) return { passed: true, source: "RULE" };
  const passed = !!temu && temu.heldCount > 0 && temu.absences <= (temu.maxAbsences ?? 2);
  return { passed, source: "RULE" };
}

/** Parses the Settings value (array of NRPs, or newline/comma separated text); null = not configured. */
export function parseIpfFailedNrps(value: unknown): Set<string> | null {
  if (Array.isArray(value)) return new Set(value.map((v) => String(v).trim()).filter(Boolean));
  if (typeof value === "string" && value.trim()) return new Set(value.split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean));
  return null;
}

export const IPF_PASSED_MESSAGE =
  "Selamat, Anda dinyatakan LULUS IPF (Inclenation) GRADAKS 2026 dan telah memenuhi syarat untuk memperoleh sertifikat IPF.";
export const IPF_FAILED_MESSAGE =
  "Anda dinyatakan BELUM LULUS IPF (Inclenation) GRADAKS 2026 dan belum memenuhi syarat untuk memperoleh sertifikat IPF. " +
  "Anda disarankan mengikuti IPF tahun depan karena sertifikat IPF merupakan syarat yudisium.";
