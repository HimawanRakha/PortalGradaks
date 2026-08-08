"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertRole, ForbiddenError } from "@/lib/auth/dal";
import { Role, FlagStatus, AttendanceStatus } from "@/app/generated/prisma/enums";
import { upsertMentorAttendance } from "@/lib/scoring/upsert";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function resolveFlagAction(flagId: string): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.KEPALA_REGION, Role.ADMIN);

    const flag = await prisma.flag.findUniqueOrThrow({
      where: { id: flagId },
      include: { unit: true },
    });

    // Check scope if role is KEPALA_REGION
    if (user.role === Role.KEPALA_REGION && flag.unit?.regionId !== user.regionId) {
      return { ok: false, error: "Anda tidak berwenang menyelesaikan flag dari region lain." };
    }

    await prisma.flag.update({
      where: { id: flagId },
      data: {
        status: FlagStatus.RESOLVED,
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
      },
    });

    revalidatePath("/kepala-region/escalation");
    revalidatePath("/mentor/flags");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyelesaikan flag." };
  }
}

const mentorAttendanceEntrySchema = z.object({
  id: z.string(),
  status: z.enum(["HADIR", "IZIN", "ALPA"]),
  participationScore: z.number().min(1).max(4).nullable(),
});

export async function saveMentorAttendanceAction(
  sessionId: string,
  entries: Array<{ id: string; status: string; participationScore: number | null }>,
): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.KEPALA_REGION);
    if (!user.regionId) throw new ForbiddenError("Akun Anda belum ditautkan ke wilayah region mana pun.");

    const parsed = z.array(mentorAttendanceEntrySchema).parse(entries);
    const submittedMentorIds = new Set(parsed.map((e) => e.id));

    const regionMentors = await prisma.user.findMany({
      where: { role: Role.MENTOR, unit: { regionId: user.regionId } },
      select: { id: true },
    });
    const regionMentorIds = regionMentors.map((m) => m.id);

    // Delete attendance records for unselected/undone mentors in this region
    const unselectedMentorIds = regionMentorIds.filter((id) => !submittedMentorIds.has(id));
    if (unselectedMentorIds.length > 0) {
      await prisma.mentorAttendance.deleteMany({
        where: {
          sessionId,
          mentorId: { in: unselectedMentorIds },
        },
      });
    }

    const mentorIds = Array.from(submittedMentorIds);
    if (mentorIds.length > 0) {
      const mentorsInRegion = await prisma.user.count({
        where: { id: { in: mentorIds }, role: Role.MENTOR, unit: { regionId: user.regionId } },
      });
      if (mentorsInRegion !== mentorIds.length) {
        return { ok: false, error: "Satu atau lebih mentor bukan bagian dari region Anda." };
      }
    }

    for (const entry of parsed) {
      await upsertMentorAttendance({
        mentorId: entry.id,
        sessionId,
        status: entry.status as AttendanceStatus,
        participationScore: entry.participationScore,
        actorUserId: user.id,
      });
    }

    revalidatePath("/kepala-region/mentor-attendance");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan presensi mentor." };
  }
}
