/**
 * Undo a wrong-type PERSONALITY import when no backup predates it: restores
 * each still-affected profile to the last value set by a REAL personality
 * CSV (an import row whose raw data actually carries an mbti/temperament
 * column) imported before the bad one. Profiles of maba who never appeared
 * in a real personality CSV are left untouched — they had nothing to lose.
 *
 *   npx tsx --conditions=react-server scratch/restore-personality-from-history.ts <badImportId> [--apply]
 *
 * Dry run by default. With --apply the current state is saved to
 * backups/<stamp>-before-restore-history/ first, then all updates run in one
 * transaction.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

async function run() {
  const badId = process.argv[2];
  const apply = process.argv.includes("--apply");
  const bad = await prisma.import.findUniqueOrThrow({ where: { id: badId } });
  if (bad.type !== "PERSONALITY") throw new Error(`Import ${badId} bertipe ${bad.type}, bukan PERSONALITY.`);

  const affected = await prisma.personalityProfile.findMany({ where: { importId: badId } });
  const ids = affected.map((p) => p.studentId);

  const history = await prisma.importRow.findMany({
    where: {
      matchedStudentId: { in: ids },
      action: { in: ["CREATED", "UPDATED"] },
      import: { type: "PERSONALITY", createdAt: { lt: bad.createdAt } },
    },
    select: { matchedStudentId: true, rawData: true, importId: true },
    orderBy: [{ import: { createdAt: "asc" } }, { rowNumber: "asc" }],
  });
  const lastReal = new Map<string, { mbtiType: string | null; temperament: string | null; importId: string }>();
  for (const r of history) {
    const raw = r.rawData as Record<string, string>;
    if (!("mbtitype" in raw || "mbti" in raw || "mbti_type" in raw || "temperament" in raw)) continue; // another wrong-type file
    lastReal.set(r.matchedStudentId!, {
      mbtiType: raw["mbtitype"] || raw["mbti"] || raw["mbti_type"] || null,
      temperament: raw["temperament"] || null,
      importId: r.importId,
    });
  }

  // Cross-check against the pre-import snapshot the bad import itself recorded.
  const badRows = await prisma.importRow.findMany({ where: { importId: badId }, orderBy: { rowNumber: "asc" } });
  const snapshot = new Map<string, { mbtiType: string | null; temperament: string | null }>();
  for (const r of badRows) if (r.matchedStudentId && !snapshot.has(r.matchedStudentId)) snapshot.set(r.matchedStudentId, r.previousValueSnapshot as never);

  const plan = affected.flatMap((p) => {
    const v = lastReal.get(p.studentId);
    return v && (v.mbtiType || v.temperament) ? [{ studentId: p.studentId, ...v }] : [];
  });
  const agreeWithSnapshot = plan.filter((p) => {
    const s = snapshot.get(p.studentId);
    return s && s.mbtiType === p.mbtiType && s.temperament === p.temperament;
  }).length;
  console.log({ affected: affected.length, toRestore: plan.length, neverHadData: affected.length - plan.length, agreeWithSnapshot });

  if (!apply) {
    console.log("Dry run — tambahkan --apply untuk memulihkan.");
    return prisma.$disconnect();
  }
  const dir = path.join("backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-before-restore-history`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "personality_profiles_before_restore.json"), JSON.stringify(affected, null, 2));

  await prisma.$transaction(
    async (tx) => {
      for (const p of plan) {
        await tx.personalityProfile.update({
          where: { studentId: p.studentId },
          data: { mbtiType: p.mbtiType, temperament: p.temperament, importId: p.importId },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  console.log(`Dipulihkan ${plan.length} profil. Salinan kondisi sebelum pemulihan: ${dir}`);
  await prisma.$disconnect();
}
run();
