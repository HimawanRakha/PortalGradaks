"use server";

import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { ReminderStatus, ReminderTrigger, Role } from "@/app/generated/prisma/enums";

type ActionResult = { ok: true; at: string } | { ok: false; error: string };

const MAX_LOGGED_MESSAGE_LENGTH = 4000;

/**
 * Notes that admin opened (or copied) the BC for a unit, which feeds the
 * "BC terakhir dibuka" caption on the Tracking Unit page so a manual
 * broadcast round doesn't double-ping the same mentor. Opening WhatsApp
 * can't prove the message was actually sent from there, hence "dibuka" —
 * and there's deliberately no revalidatePath: the caller updates the
 * caption itself, because re-running that page's heavy query once per
 * click would make working through a whole queue slow.
 */
export async function recordBroadcastAction(unitId: string, message: string): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.ADMIN);
    if (typeof unitId !== "string" || typeof message !== "string") {
      return { ok: false, error: "Permintaan tidak valid." };
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, mentor: { select: { id: true, phone: true } } },
    });
    if (!unit) return { ok: false, error: "Unit tidak ditemukan." };

    const log = await prisma.reminderLog.create({
      data: {
        unitId: unit.id,
        mentorId: unit.mentor?.id ?? null,
        phoneSnapshot: unit.mentor?.phone ?? null,
        message: message.slice(0, MAX_LOGGED_MESSAGE_LENGTH),
        status: ReminderStatus.SENT,
        trigger: ReminderTrigger.MANUAL,
        triggeredByUserId: user.id,
      },
      select: { createdAt: true },
    });
    return { ok: true, at: log.createdAt.toISOString() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mencatat BC." };
  }
}
