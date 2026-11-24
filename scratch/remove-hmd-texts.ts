/**
 * Removes the "data diteruskan/diberikan ke HMD" sentences from the maba-facing
 * texts stored in the database: Settings (raport thank-you, data-insufficient
 * message), recommendation rules, and already-finalized raport snapshots.
 * Prints every change; backs up the touched rows first.
 *
 *   npx tsx --conditions=react-server scratch/remove-hmd-texts.ts [--apply]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\s*Seluruh data pengembangan Anda juga diteruskan kepada Himpunan Mahasiswa Departemen \(HMD\) sebagai bekal pendampingan selanjutnya\./g, ""],
  [/\s*Seluruh data pengembangan Anda akan diberikan kepada HMD untuk pengembangan lebih lanjut\./g, ""],
  [/pendampingan lanjutan dari HMD untuk/g, "pendampingan lanjutan untuk"],
];
const clean = (t: string) => REPLACEMENTS.reduce((acc, [re, to]) => acc.replace(re, to), t);

async function main() {
  const apply = process.argv.includes("--apply");
  const settings = (await prisma.setting.findMany({ where: { key: { in: ["raport.thankYouMessage", "attendance.dataInsufficientMessage"] } } }))
    .filter((s) => typeof s.value === "string" && clean(s.value) !== s.value);
  const rules = (await prisma.recommendationRule.findMany()).filter(
    (r) => (r.descriptionText && clean(r.descriptionText) !== r.descriptionText) || (r.recommendationText && clean(r.recommendationText) !== r.recommendationText),
  );
  const snaps = (await prisma.raportSnapshot.findMany({ where: { description: { contains: "HMD" } }, select: { id: true, studentId: true, description: true } }))
    .filter((s) => s.description && clean(s.description) !== s.description);
  console.log(`setting: ${settings.map((s) => s.key).join(", ") || "-"} | rule: ${rules.map((r) => r.name).join(", ") || "-"} | snapshot: ${snaps.length}`);
  for (const s of settings) console.log(`  ${s.key} -> ${clean(s.value as string)}`);
  for (const r of rules) console.log(`  ${r.name} -> ${clean(r.descriptionText ?? "")}`);
  if (!apply) return console.log("dry run — tambahkan --apply untuk menyimpan");

  const dir = path.join("backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-hapus-teks-hmd`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "rows.json"), JSON.stringify({ settings, rules, snaps }, null, 1));
  for (const s of settings) await prisma.setting.update({ where: { key: s.key }, data: { value: clean(s.value as string) } });
  for (const r of rules)
    await prisma.recommendationRule.update({
      where: { id: r.id },
      data: { descriptionText: r.descriptionText ? clean(r.descriptionText) : null, recommendationText: r.recommendationText ? clean(r.recommendationText) : null },
    });
  for (const s of snaps) await prisma.raportSnapshot.update({ where: { id: s.id }, data: { description: clean(s.description!) } });
  const left = await prisma.raportSnapshot.count({ where: { OR: [{ description: { contains: "HMD" } }, { recommendation: { contains: "HMD" } }] } });
  console.log(`selesai (backup: ${dir}); snapshot yang masih memuat "HMD": ${left}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
