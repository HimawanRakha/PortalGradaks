import "server-only";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus, SessionMode } from "@/app/generated/prisma/enums";

export type TemuAttendanceCounts = {
  temuAbsences: number;
  temuOfflineAbsences: number;
};

/**
 * Counts a student's IZIN/ALPA absences across the "Temu FTEIC" meeting
 * series (Activity.isTemuFteic), and separately among just the OFFLINE-mode
 * sessions within that series — the two inputs to the attendance-shortfall
 * gate in finalizeRaportsAction. Filters out NA-mode sessions defensively
 * (the synthetic "UMUM" session per activity is for non-attendance scoring
 * inputs and never receives real attendance rows, but this can't be wrong
 * either way).
 */
export async function getTemuAttendanceCounts(studentId: string): Promise<TemuAttendanceCounts> {
  const absences = await prisma.attendance.findMany({
    where: {
      studentId,
      status: { in: [AttendanceStatus.IZIN, AttendanceStatus.ALPA] },
      session: {
        mode: { not: SessionMode.NA },
        activity: { isTemuFteic: true },
      },
    },
    select: { session: { select: { mode: true } } },
  });

  const temuOfflineAbsences = absences.filter((a) => a.session.mode === SessionMode.OFFLINE).length;

  return { temuAbsences: absences.length, temuOfflineAbsences };
}
