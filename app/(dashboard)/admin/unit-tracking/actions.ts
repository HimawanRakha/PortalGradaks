"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { assertRole } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { getUnitProgressList } from "@/lib/scoring/unit-progress";
import { sendReminderForUnitProgress, sendUnitReminderById } from "@/lib/reminder/service";

type ActionResult = { ok: true; summary?: string } | { ok: false; error: string };

export async function sendUnitReminderAction(unitId: string): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.ADMIN);
    const result = await sendUnitReminderById(unitId, "MANUAL", user.id);
    revalidatePath("/admin/unit-tracking");
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, summary: "Reminder terkirim." };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mengirim reminder." };
  }
}

export async function sendBulkIncompleteRemindersAction(): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.ADMIN);
    const units = await getUnitProgressList();
    const incomplete = units.filter((u) => !u.isComplete);

    if (incomplete.length === 0) {
      return { ok: true, summary: "Tidak ada unit yang belum lengkap saat ini — tidak ada reminder yang dikirim." };
    }

    let sent = 0;
    let failed = 0;
    for (const unit of incomplete) {
      const result = await sendReminderForUnitProgress(unit, "MANUAL", user.id);
      if (result.ok) sent++;
      else failed++;
    }

    revalidatePath("/admin/unit-tracking");
    return {
      ok: true,
      summary: `Reminder terkirim ke ${sent} dari ${incomplete.length} unit yang belum lengkap${failed > 0 ? ` (${failed} gagal — cek nomor WA mentor)` : ""}.`,
    };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mengirim reminder massal." };
  }
}
