import type { UnitChecklist } from "@/lib/scoring/unit-checklist";

/**
 * Pure (no `server-only`) so the public /cek-unit copy button and the
 * admin's BC dialog share one list format — a mentor gets the same shape of
 * message whether the Ketua Unit or PSDM sends it.
 */

export type BroadcastKind = "REMINDER" | "THANK_YOU";

export type BroadcastTemplates = {
  reminder: string;
  thankYou: string;
  /** Empty string = not configured; paragraphs that use {{feedbackUrl}} are then dropped. */
  feedbackUrl: string;
};

/** A ready-to-send BC for one unit. `message` is already fully rendered. */
export type UnitBroadcast = {
  kind: BroadcastKind;
  pct: number;
  incompleteCount: number;
  message: string;
};

/** WhatsApp bold is `*text*`: one bold activity heading, then its missing items as "- " bullets. */
export function formatIncompleteList(items: { activityName: string; label: string }[]): string {
  const byActivity = new Map<string, string[]>();
  for (const it of items) {
    const list = byActivity.get(it.activityName) ?? [];
    list.push(it.label);
    byActivity.set(it.activityName, list);
  }
  return Array.from(byActivity, ([act, labels]) => `*${act}*\n${labels.map((l) => `- ${l}`).join("\n")}`).join("\n\n");
}

/**
 * Replaces {{key}} placeholders. Unknown ones are left untouched rather than
 * erroring (a typo in the admin's template stays visible in the preview
 * instead of crashing the page).
 *
 * A paragraph (block separated by a blank line) containing a placeholder
 * that resolved to an empty string is dropped whole. That's what lets the
 * admin leave "Link Feedback" blank without the message ending up with a
 * dangling "mohon isi feedback di link berikut:" and nothing after it.
 */
export function renderBroadcastTemplate(template: string, vars: Record<string, string | number>): string {
  const paragraphs: string[] = [];
  for (const block of template.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    let hasEmptyValue = false;
    const text = block.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      const value = vars[key];
      if (value === undefined) return match;
      const str = String(value);
      if (str.trim() === "") hasEmptyValue = true;
      return str;
    });
    if (!hasEmptyValue && text.trim() !== "") paragraphs.push(text.trim());
  }
  return paragraphs.join("\n\n");
}

/**
 * Picks the BC for a unit from the same per-activity checklist /cek-unit
 * shows: anything still missing → reminder listing it; everything of the
 * activities already underway complete → thank-you. `null` when nothing has
 * started yet (no checklist item to remind about or thank for).
 */
export function buildUnitBroadcast(checklist: UnitChecklist, templates: BroadcastTemplates): UnitBroadcast | null {
  const incompleteCount = checklist.incompleteItems.length;
  if (incompleteCount === 0 && checklist.totalCount === 0) return null;

  const kind: BroadcastKind = incompleteCount > 0 ? "REMINDER" : "THANK_YOU";
  const message = renderBroadcastTemplate(kind === "REMINDER" ? templates.reminder : templates.thankYou, {
    mentorName: checklist.mentorName ?? "Mentor",
    unitCode: checklist.unitCode,
    unitName: checklist.unitName,
    pct: checklist.pct,
    incompleteCount,
    incompleteList: formatIncompleteList(checklist.incompleteItems),
    feedbackUrl: templates.feedbackUrl,
  });

  return { kind, pct: checklist.pct, incompleteCount, message };
}
