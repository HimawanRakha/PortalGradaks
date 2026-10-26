/**
 * Undo for a CSV that was imported with the wrong type (PERSONALITY instead
 * of KEAHLIAN), which blanked mbtiType/temperament for the matched maba.
 * Restores exactly those profiles from the pre-import backup, and only if
 * they still point at the bad import (nothing touched them since).
 *
 *   npx tsx --conditions=react-server scratch/restore-personality-from-backup.ts <importId> [--apply]
 *
 * Without --apply it only prints what it would change. With --apply it first
 * writes the current state to backups/<stamp>-before-restore/ and then
 * restores inside one transaction.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

type BackupProfile = { studentId: string; mbtiType: string | null; temperament: string | null; importId: string | null };

async function run() {
  const importId = process.argv[2];
  const apply = process.argv.includes("--apply");
  const imp = await prisma.import.findUniqueOrThrow({ where: { id: importId }, include: { rows: true } });
  if (imp.type !== "PERSONALITY") throw new Error(`Import ${importId} bertipe ${imp.type}, bukan PERSONALITY.`);

  const backupDir = fs.readdirSync("backups").filter((d) => !d.includes("before-restore")).sort()[0];
  const backupTime = new Date(backupDir.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, "T$1:$2:$3.$4Z"));
  if (!(backupTime < imp.createdAt)) throw new Error("Backup tidak lebih tua dari impor yang salah.");
  const backup = JSON.parse(fs.readFileSync(path.join("backups", backupDir, "personality_profiles.json"), "utf8")) as BackupProfile[];
  const byStudent = new Map(backup.map((b) => [b.studentId, b]));

  const studentIds = [...new Set(imp.rows.map((r) => r.matchedStudentId).filter((x): x is string => !!x))];
  const current = await prisma.personalityProfile.findMany({ where: { studentId: { in: studentIds } } });

  const plan = current
    .filter((c) => c.importId === importId)
    .map((c) => ({ current: c, original: byStudent.get(c.studentId) }));
  const missing = plan.filter((p) => !p.original);
  const skipped = current.filter((c) => c.importId !== importId);

  console.log({ backupDir, studentsInImport: studentIds.length, toRestore: plan.length - missing.length, noBackupRow: missing.length, changedSinceSkipped: skipped.length });
  for (const p of plan.slice(0, 5)) console.log("  ", p.current.studentId, "->", p.original?.mbtiType, p.original?.temperament?.slice(0, 50));
  if (missing.length > 0) console.log("  tanpa data backup (dibiarkan):", missing.map((m) => m.current.studentId));
  if (!apply) {
    console.log("\nDry run — jalankan lagi dengan --apply untuk memulihkan.");
    return prisma.$disconnect();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safety = path.join("backups", `${stamp}-before-restore`);
  fs.mkdirSync(safety, { recursive: true });
  fs.writeFileSync(path.join(safety, "personality_profiles_before_restore.json"), JSON.stringify(current, null, 2));

  // Interactive transaction with a long timeout: 50 round-trips to the remote
  // DB exceed Prisma's 5 s default, and all-or-nothing matters here.
  await prisma.$transaction(
    async (tx) => {
      for (const p of plan) {
        if (!p.original) continue;
        await tx.personalityProfile.update({
          where: { studentId: p.current.studentId },
          data: { mbtiType: p.original.mbtiType, temperament: p.original.temperament, importId: p.original.importId },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  const after = await prisma.personalityProfile.findMany({ where: { studentId: { in: studentIds } } });
  const ok = after.filter((a) => {
    const o = byStudent.get(a.studentId);
    return o && a.mbtiType === o.mbtiType && a.temperament === o.temperament;
  }).length;
  console.log(`Dipulihkan. Cocok dengan backup: ${ok}/${after.length}. Salinan kondisi sebelum pemulihan: ${safety}`);
  await prisma.$disconnect();
}
run();
