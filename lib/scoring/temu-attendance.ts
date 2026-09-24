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
  const [activeTemuSessions, attendances] = await Promise.all([
    prisma.activitySession.findMany({
      where: {
        activity: { isTemuFteic: true, active: true },
        mode: { not: SessionMode.NA },
      },
      select: { id: true, mode: true },
    }),
    prisma.attendance.findMany({
      where: {
        studentId,
        session: { activity: { isTemuFteic: true } },
      },
      select: { sessionId: true, status: true },
    }),
  ]);

  const attMap = new Map(attendances.map((a) => [a.sessionId, a.status]));

  let temuAbsences = 0;
  let temuOfflineAbsences = 0;

  for (const session of activeTemuSessions) {
    const status = attMap.get(session.id) ?? AttendanceStatus.ALPA;

    if (status === AttendanceStatus.IZIN || status === AttendanceStatus.ALPA) {
      temuAbsences++;
      if (session.mode === SessionMode.OFFLINE) {
        temuOfflineAbsences++;
      }
    }
  }

  return { temuAbsences, temuOfflineAbsences };
}
