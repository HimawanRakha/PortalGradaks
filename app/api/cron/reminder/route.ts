import { prisma } from "@/lib/prisma";
import { getUnitProgressList } from "@/lib/scoring/unit-progress";
import { sendReminderForUnitProgress, sleep, REMINDER_SEND_DELAY_MS } from "@/lib/reminder/service";
import {
  SETTING_KEYS,
  DEFAULT_REMINDER_SEND_HOUR,
  DEFAULT_REMINDER_COOLDOWN_HOURS,
} from "@/lib/scoring/setting-keys";

// Headroom for pacing sends (see REMINDER_SEND_DELAY_MS) across a large
// incomplete-unit count without the function timing out. Raise this if your
// Vercel plan allows a higher ceiling and you expect many incomplete units
// at once; lower plans may cap this regardless of what's requested here.
export const maxDuration = 60;

/**
 * Vercel Cron fires this hourly (see vercel.json) — it does NOT have a
 * logged-in admin session, so this can't use assertRole like every other
 * mutation in this app. Instead it's gated by CRON_SECRET, which Vercel
 * automatically sends as `Authorization: Bearer <CRON_SECRET>` on scheduled
 * invocations once that env var is set (see .env.example).
 *
 * Firing hourly but only actually sending once a day is deliberate: the
 * *cadence* (which hour, on/off) is admin-configurable at runtime via
 * Master Data > Settings (Setting rows), which a fixed vercel.json cron
 * expression alone can't be — this route re-checks those settings on every
 * fire and no-ops outside the configured hour, so admin never needs a
 * redeploy to change the schedule.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: "CRON_SECRET belum diatur di environment variable server." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [enabledSetting, hourSetting, cooldownSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.reminderAutoEnabled } }),
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.reminderSendHour } }),
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.reminderCooldownHours } }),
  ]);

  const autoEnabled = !!enabledSetting?.value;
  if (!autoEnabled) {
    return Response.json({ skipped: "Reminder otomatis sedang nonaktif (Master Data > Settings)." });
  }

  const sendHour = typeof hourSetting?.value === "number" ? hourSetting.value : DEFAULT_REMINDER_SEND_HOUR;
  const currentHourWib = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()),
  );
  if (currentHourWib !== sendHour % 24) {
    return Response.json({ skipped: `Bukan jam kirim (sekarang ${currentHourWib}, diatur ${sendHour} WIB).` });
  }

  const cooldownHours = typeof cooldownSetting?.value === "number" ? cooldownSetting.value : DEFAULT_REMINDER_COOLDOWN_HOURS;
  const units = await getUnitProgressList();
  const incomplete = units.filter((u) => !u.isComplete);

  if (incomplete.length === 0) {
    return Response.json({ sent: 0, failed: 0, skippedCooldown: 0, totalIncomplete: 0 });
  }

  const cooldownCutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  const recentlyReminded = await prisma.reminderLog.findMany({
    where: { unitId: { in: incomplete.map((u) => u.unitId) }, status: "SENT", createdAt: { gte: cooldownCutoff } },
    select: { unitId: true },
  });
  const recentlyRemindedSet = new Set(recentlyReminded.map((r) => r.unitId));

  let sent = 0;
  let failed = 0;
  let skippedCooldown = 0;
  for (const unit of incomplete) {
    if (recentlyRemindedSet.has(unit.unitId)) {
      skippedCooldown++;
      continue;
    }
    if (sent + failed > 0) await sleep(REMINDER_SEND_DELAY_MS); // pace sends — see comment on REMINDER_SEND_DELAY_MS
    const result = await sendReminderForUnitProgress(unit, "AUTOMATIC", null);
    if (result.ok) sent++;
    else failed++;
  }

  return Response.json({ sent, failed, skippedCooldown, totalIncomplete: incomplete.length });
}
