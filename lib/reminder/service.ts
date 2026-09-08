import "server-only";
import { prisma } from "@/lib/prisma";
import { ReminderTrigger } from "@/app/generated/prisma/enums";
import { sendWhatsAppMessage } from "@/lib/whatsapp/fonnte";
import { SETTING_KEYS, DEFAULT_REMINDER_MESSAGE_TEMPLATE } from "@/lib/scoring/setting-keys";
import { getUnitProgressList, type UnitProgress } from "@/lib/scoring/unit-progress";

export type ReminderResult = { ok: true } | { ok: false; error: string };

/**
 * Fonnte (and unofficial WhatsApp gateways generally) automate a real WA
 * account rather than using Meta's sanctioned Business API — WhatsApp's
 * abuse detection weighs send velocity heavily, so firing a whole batch of
 * near-identical messages back-to-back is one of the more avoidable ways to
 * get the underlying number flagged/banned. Callers looping over multiple
 * units (bulk send, cron) should await `sleep(REMINDER_SEND_DELAY_MS)`
 * between iterations — a single manual send never needs this.
 */
export const REMINDER_SEND_DELAY_MS = 300;
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Replaces {{key}} placeholders; leaves unknown ones untouched rather than erroring. */
export function buildReminderMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value !== undefined ? String(value) : match;
  });
}

async function getMessageTemplate(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.reminderMessageTemplate } });
  return typeof setting?.value === "string" && setting.value.trim() !== "" ? setting.value : DEFAULT_REMINDER_MESSAGE_TEMPLATE;
}

/**
 * Core send+log logic for one already-fetched UnitProgress row. Callers
 * that already hold a full getUnitProgressList() result (the bulk action,
 * the cron) should call this directly instead of sendUnitReminderById, so a
 * loop over N units never re-fetches the whole unit list N times.
 */
export async function sendReminderForUnitProgress(
  unit: UnitProgress,
  trigger: ReminderTrigger,
  triggeredByUserId: string | null,
): Promise<ReminderResult> {
  if (!unit.mentorId) {
    await prisma.reminderLog.create({
      data: { unitId: unit.unitId, message: "", status: "FAILED", errorReason: "Unit belum memiliki mentor yang ditugaskan.", trigger, triggeredByUserId },
    });
    return { ok: false, error: `Unit ${unit.unitCode} belum memiliki mentor yang ditugaskan.` };
  }

  if (!unit.mentorPhone) {
    await prisma.reminderLog.create({
      data: {
        unitId: unit.unitId,
        mentorId: unit.mentorId,
        message: "",
        status: "FAILED",
        errorReason: "Nomor WA mentor belum diisi.",
        trigger,
        triggeredByUserId,
      },
    });
    return { ok: false, error: `Mentor ${unit.mentorName ?? ""} (unit ${unit.unitCode}) belum punya nomor WA di Master Data > Akun.` };
  }

  const template = await getMessageTemplate();
  const message = buildReminderMessage(template, {
    mentorName: unit.mentorName ?? "Mentor",
    unitCode: unit.unitCode,
    unitName: unit.unitName,
    attPct: unit.attPct,
    scorePct: unit.scorePct,
  });

  const sendResult = await sendWhatsAppMessage(unit.mentorPhone, message);

  await prisma.reminderLog.create({
    data: {
      unitId: unit.unitId,
      mentorId: unit.mentorId,
      phoneSnapshot: unit.mentorPhone,
      message,
      status: sendResult.ok ? "SENT" : "FAILED",
      errorReason: sendResult.ok ? null : sendResult.error,
      trigger,
      triggeredByUserId,
    },
  });

  if (!sendResult.ok) return { ok: false, error: sendResult.error };
  return { ok: true };
}

/** Convenience wrapper for a single manual send where the caller doesn't already have a UnitProgress list. */
export async function sendUnitReminderById(
  unitId: string,
  trigger: ReminderTrigger,
  triggeredByUserId: string | null,
): Promise<ReminderResult> {
  const units = await getUnitProgressList();
  const unit = units.find((u) => u.unitId === unitId);
  if (!unit) return { ok: false, error: "Unit tidak ditemukan." };
  return sendReminderForUnitProgress(unit, trigger, triggeredByUserId);
}
