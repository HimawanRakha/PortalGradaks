"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, ForbiddenError } from "@/lib/auth/dal";
import { upsertScore, upsertAttendance, upsertGroupScore } from "@/lib/scoring/upsert";
import { Role, AttendanceStatus, SessionMode, LogbookStatus } from "@/app/generated/prisma/enums";

async function requireMentor() {
  const user = await getCurrentUser();
  if (user.role !== Role.MENTOR || !user.unitId) {
    throw new ForbiddenError("Hanya mentor yang dapat melakukan tindakan ini.");
  }
  return user;
}

async function assertStudentInMentorUnit(studentId: string, unitId: string) {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { unitId: true } });
  if (student.unitId !== unitId) throw new ForbiddenError("Maba ini bukan bagian dari unit Anda.");
}

const scoreValuesSchema = z.record(z.string(), z.number().nullable());

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveStudentScoresAction(
  studentId: string,
  sessionId: string,
  rawValues: Record<string, number | null>,
): Promise<ActionResult> {
  try {
    const user = await requireMentor();
    await assertStudentInMentorUnit(studentId, user.unitId!);
    const values = scoreValuesSchema.parse(rawValues);

    for (const [parameterId, value] of Object.entries(values)) {
      await upsertScore({ studentId, parameterId, sessionId, value, actorUserId: user.id });
    }

    revalidatePath("/mentor/scoring");
    revalidatePath("/mentor");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan skor." };
  }
}

const attendanceEntrySchema = z.object({
  studentId: z.string(),
  status: z.enum(["HADIR", "IZIN", "ALPA"]),
  participationScore: z.number().min(1).max(4).nullable(),
});

export async function saveAttendanceAction(
  sessionId: string,
  mode: "ONLINE" | "OFFLINE" | "NA",
  entries: Array<{ studentId: string; status: string; participationScore: number | null }>,
): Promise<ActionResult> {
  try {
    const user = await requireMentor();
    const parsed = z.array(attendanceEntrySchema).parse(entries);

    for (const entry of parsed) {
      await assertStudentInMentorUnit(entry.studentId, user.unitId!);
      await upsertAttendance({
        studentId: entry.studentId,
        sessionId,
        status: entry.status as AttendanceStatus,
        participationScore: entry.participationScore,
        mode: mode as SessionMode,
        actorUserId: user.id,
      });
    }

    revalidatePath("/mentor/attendance");
    revalidatePath("/mentor");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan presensi." };
  }
}

export async function createGroupAction(materialId: string, name: string, studentIds: string[]): Promise<ActionResult> {
  try {
    const user = await requireMentor();
    for (const studentId of studentIds) {
      await assertStudentInMentorUnit(studentId, user.unitId!);
    }
    const group = await prisma.group.create({
      data: { materialId, unitId: user.unitId!, name },
    });
    await prisma.groupMember.createMany({
      data: studentIds.map((studentId) => ({ groupId: group.id, studentId })),
    });
    revalidatePath("/mentor/scoring");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal membuat kelompok." };
  }
}

export async function saveGroupScoresAction(groupId: string, rawValues: Record<string, number | null>): Promise<ActionResult> {
  try {
    const user = await requireMentor();
    const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    if (group.unitId !== user.unitId) throw new ForbiddenError("Kelompok ini bukan milik unit Anda.");
    const values = scoreValuesSchema.parse(rawValues);

    for (const [parameterId, value] of Object.entries(values)) {
      await upsertGroupScore({ groupId, parameterId, value, actorUserId: user.id });
    }

    revalidatePath("/mentor/scoring");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan nilai kelompok." };
  }
}

export async function verifyLogbookEntryAction(
  entryId: string,
  status: "LENGKAP" | "PERLU_REVISI",
  note: string,
): Promise<ActionResult> {
  try {
    const user = await requireMentor();
    const entry = await prisma.logbookEntry.findUniqueOrThrow({ where: { id: entryId }, select: { studentId: true } });
    await assertStudentInMentorUnit(entry.studentId, user.unitId!);

    await prisma.logbookEntry.update({
      where: { id: entryId },
      data: {
        status: status as LogbookStatus,
        note: note || null,
        verifiedByUserId: user.id,
        verifiedAt: new Date(),
      },
    });

    revalidatePath("/mentor/logbook");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal memverifikasi logbook." };
  }
}

export async function confirmSessionAction(sessionId: string): Promise<ActionResult> {
  try {
    const user = await requireMentor();
    await prisma.confirmation.upsert({
      where: { sessionId_unitId: { sessionId, unitId: user.unitId! } },
      update: { confirmedByUserId: user.id, confirmedAt: new Date() },
      create: { sessionId, unitId: user.unitId!, confirmedByUserId: user.id },
    });
    revalidatePath("/mentor/confirmations");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mengonfirmasi sesi." };
  }
}

export async function raiseFlagAction(studentId: string | null, message: string): Promise<ActionResult> {
  try {
    const user = await requireMentor();
    if (studentId) await assertStudentInMentorUnit(studentId, user.unitId!);
    if (!message.trim()) return { ok: false, error: "Pesan flag tidak boleh kosong." };

    await prisma.flag.create({
      data: {
        studentId: studentId ?? undefined,
        unitId: user.unitId!,
        raisedByUserId: user.id,
        message: message.trim(),
      },
    });

    revalidatePath("/mentor/flags");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mengirim flag." };
  }
}
