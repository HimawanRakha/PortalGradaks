import "server-only";

export type SendWhatsAppResult = { ok: true } | { ok: false; error: string };

/**
 * Fonnte (and most Indonesian WA gateways) expect 62xxxxxxxxxx — no leading
 * "+" or "0". Normalizing here (rather than forcing every caller/import row
 * to store numbers pre-formatted) means admin can type/import "08..." or
 * "+62..." and it still works.
 */
function normalizeIndonesianPhone(raw: string): string {
  let phone = raw.trim().replace(/[^0-9+]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  return phone;
}

/**
 * Sends one WhatsApp message via Fonnte (https://fonnte.com). Isolated
 * behind this single function so swapping to a different gateway later
 * (Wablas, WhatsApp Cloud API, ...) only means rewriting this file — nothing
 * in lib/reminder/service.ts or the callers needs to change.
 *
 * Requires FONNTE_API_TOKEN (the device token from the Fonnte dashboard) —
 * see .env.example. Fonnte's exact response shape isn't verified against a
 * live account here; if error messages ever look wrong, check the response
 * body shape against the current Fonnte API docs and adjust the parsing
 * below.
 */
export async function sendWhatsAppMessage(phoneRaw: string, message: string): Promise<SendWhatsAppResult> {
  const token = process.env.FONNTE_API_TOKEN;
  if (!token) {
    return { ok: false, error: "FONNTE_API_TOKEN belum diatur di environment variable server." };
  }

  const phone = normalizeIndonesianPhone(phoneRaw);
  if (!phone || phone.length < 8) {
    return { ok: false, error: `Nomor WA "${phoneRaw}" tidak valid.` };
  }

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ target: phone, message }),
    });

    const body: unknown = await res.json().catch(() => null);
    const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const status = bodyObj?.status;

    if (!res.ok || status === false) {
      const reason =
        (typeof bodyObj?.reason === "string" && bodyObj.reason) ||
        (typeof bodyObj?.detail === "string" && bodyObj.detail) ||
        `HTTP ${res.status}`;
      return { ok: false, error: `Gateway Fonnte menolak pesan: ${reason}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `Gagal menghubungi Fonnte: ${error.message}` : "Gagal menghubungi gateway Fonnte." };
  }
}
