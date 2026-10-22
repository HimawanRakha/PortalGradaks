/**
 * Pure helpers (no `server-only`) so the admin's client-side BC dialog can
 * build the wa.me deep link directly in the browser. Nothing here sends
 * anything — PSDM taps the link and presses "send" in WhatsApp themselves.
 */

/**
 * wa.me expects 62xxxxxxxxxx — no leading "+" or "0". Normalizing here
 * (rather than forcing every account/import row to store numbers
 * pre-formatted) means admin can type/import "08..." or "+62..." and the
 * link still works.
 */
export function normalizeIndonesianPhone(raw: string): string {
  let phone = raw.trim().replace(/[^0-9+]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  return phone;
}

/** The wa.me-ready number, or null when there's none on file or it's too short to be real. */
export function usablePhone(raw: string | null | undefined): string | null {
  const normalized = raw ? normalizeIndonesianPhone(raw) : "";
  return normalized.length >= 8 ? normalized : null;
}

/**
 * Deep link that opens WhatsApp with `message` pre-filled. With a usable
 * phone it opens that chat directly; without one `wa.me/?text=` makes
 * WhatsApp ask which contact/group to send it to — so the BC is still
 * usable, e.g. for pasting into the unit's WA group.
 */
export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  return `https://wa.me/${usablePhone(phone) ?? ""}?text=${encodeURIComponent(message)}`;
}
