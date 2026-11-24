/**
 * Re-builds the conclusion text of finalized (aggregated) raports whose
 * description lacks one of its two paragraphs — e.g. a Nilai Personal of
 * 84.998 that fell between the 70-84.99 and >= 85 rules before the rule
 * matcher truncated scores to 2 decimals. Uses the frozen snapshot values,
 * the active rules and Kuesioner 1; only `description`/`recommendation`
 * change, after a backup.
 *
 *   npx tsx --conditions=react-server scratch/fix-incomplete-conclusions.ts [--apply]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import type { ComputedScores } from "../lib/scoring/calculate";
import { getActiveRecommendationRulesForEvaluation, evaluateRecommendation } from "../lib/scoring/recommendation";
import { parseK1Interest } from "../lib/scoring/k1";

async function main() {
  const apply = process.argv.includes("--apply");
  const rules = await getActiveRecommendationRulesForEvaluation();
  const snaps = await prisma.raportSnapshot.findMany({
    where: { dataInsufficient: false },
    select: { id: true, studentId: true, recommendation: true, description: true, breakdown: true, student: { select: { nrp: true, name: true } } },
  });
  const broken = snaps.filter((s) => (s.description ?? "").split("\n\n").length !== 2);
  const k1 = new Map(
    (await prisma.questionnaireStatus.findMany({ where: { code: "K1", studentId: { in: broken.map((s) => s.studentId) } }, select: { studentId: true, raw: true } })).map((r) => [
      r.studentId,
      parseK1Interest(r.raw),
    ]),
  );
  const fixes = broken.map((s) => ({ s, ev: evaluateRecommendation(s.breakdown as unknown as ComputedScores, rules, k1.get(s.studentId) ?? null) }));
  for (const { s, ev } of fixes) {
    console.log(`${s.student.nrp} ${s.student.name}\n  lama: ${s.description}\n  baru: ${ev.description}\n  judul: ${s.recommendation} -> ${ev.recommendation}`);
  }
  console.log(`perlu diperbaiki: ${fixes.length}`);
  if (!apply) return console.log("dry run — tambahkan --apply untuk menyimpan");
  const dir = path.join("backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-perbaikan-kesimpulan`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "snapshots.json"), JSON.stringify(broken.map(({ breakdown, ...rest }) => rest), null, 1));
  for (const { s, ev } of fixes) await prisma.raportSnapshot.update({ where: { id: s.id }, data: { description: ev.description, recommendation: ev.recommendation } });
  console.log(`tersimpan (backup: ${dir})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
