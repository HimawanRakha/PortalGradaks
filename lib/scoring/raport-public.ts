import "server-only";
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS, DEFAULT_RAPORT_PUBLIC_CHECK_ENABLED } from "./setting-keys";

/** Whether the public Cek Raport page and PDF download are open (Settings toggle). */
export async function isRaportPublicCheckEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.raportPublicCheckEnabled } });
  return typeof row?.value === "boolean" ? row.value : DEFAULT_RAPORT_PUBLIC_CHECK_ENABLED;
}
