/**
 * Stores PSDM's final "Tidak Lulus IPF (Inclenation)" NRP list in Settings
 * (raport.ipfFailedNrps), read by the raport PDF (lib/scoring/ipf.ts).
 * Only NRPs of existing students are accepted; the previous value is printed
 * first so it can be restored.
 *
 *   npx tsx --conditions=react-server scratch/set-ipf-failed-nrps.ts <list.json> [--apply]
 */
import "dotenv/config";
import fs from "node:fs";
import { prisma } from "../lib/prisma";
import { SETTING_KEYS } from "../lib/scoring/setting-keys";

async function main() {
  const [file, flag] = process.argv.slice(2);
  const nrps: string[] = [...new Set((JSON.parse(fs.readFileSync(file, "utf8")) as string[]).map((n) => String(n).trim()))].sort();
  const found = await prisma.student.findMany({ where: { nrp: { in: nrps } }, select: { nrp: true } });
  const missing = nrps.filter((n) => !found.some((f) => f.nrp === n));
  if (missing.length) throw new Error(`NRP tidak ditemukan: ${missing.join(", ")}`);

  const before = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.ipfFailedNrps } });
  console.log(`nilai sebelumnya: ${JSON.stringify(before?.value ?? null)}`);
  console.log(`akan disimpan: ${nrps.length} NRP`);
  if (flag !== "--apply") return console.log("dry run — tambahkan --apply untuk menyimpan");

  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.ipfFailedNrps },
    update: { value: nrps },
    create: { key: SETTING_KEYS.ipfFailedNrps, value: nrps },
  });
  const after = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.ipfFailedNrps } });
  console.log(`tersimpan: ${(after?.value as string[]).length} NRP`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
