import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS, DEFAULT_RAPORT_PUBLIC_CHECK_ENABLED } from "./setting-keys";

/** Whether the public Cek Raport page and PDF download are open (Settings toggle). */
export async function isRaportPublicCheckEnabled(): Promise<boolean> {
  // Must be read per request: /cek-raport checks the toggle before touching
  // searchParams, so on Vercel it was prerendered at build time with the
  // toggle's value then ("dinonaktifkan") and served from cache from then on.
  await connection();
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.raportPublicCheckEnabled } });
  return typeof row?.value === "boolean" ? row.value : DEFAULT_RAPORT_PUBLIC_CHECK_ENABLED;
}
