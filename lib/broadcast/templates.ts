import "server-only";
import { prisma } from "@/lib/prisma";
import {
  SETTING_KEYS,
  DEFAULT_BROADCAST_REMINDER_TEMPLATE,
  DEFAULT_BROADCAST_THANK_YOU_TEMPLATE,
} from "@/lib/scoring/setting-keys";
import type { BroadcastTemplates } from "@/lib/broadcast/message";

/** Admin-editable BC templates + feedback link (Master Data > Pengaturan), falling back to the built-in defaults. */
export async function getBroadcastTemplates(): Promise<BroadcastTemplates> {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [SETTING_KEYS.broadcastReminderTemplate, SETTING_KEYS.broadcastThankYouTemplate, SETTING_KEYS.broadcastFeedbackUrl],
      },
    },
  });
  const values = new Map(rows.map((r) => [r.key, r.value]));

  const text = (key: string, fallback: string) => {
    const value = values.get(key);
    return typeof value === "string" && value.trim() !== "" ? value : fallback;
  };
  const feedbackUrl = values.get(SETTING_KEYS.broadcastFeedbackUrl);

  return {
    reminder: text(SETTING_KEYS.broadcastReminderTemplate, DEFAULT_BROADCAST_REMINDER_TEMPLATE),
    thankYou: text(SETTING_KEYS.broadcastThankYouTemplate, DEFAULT_BROADCAST_THANK_YOU_TEMPLATE),
    feedbackUrl: typeof feedbackUrl === "string" ? feedbackUrl.trim() : "",
  };
}
