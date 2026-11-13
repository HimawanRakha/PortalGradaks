/**
 * 1) Removes Arus Emas attendance that a mentor typed in by hand (source
 *    MENTOR) — Arus Emas must come only from PSDM's CSV import.
 * 2) Deactivates every MENTOR account (active = false: login refused and
 *    open sessions are cut off by lib/auth/dal.ts).
 *
 * Both are backed up first to backups/<stamp>-arus-emas-mentor-cleanup/ so
 * they can be undone (re-insert the rows / re-activate the listed ids).
 *
 *   npx tsx --conditions=react-server scratch/remove-mentor-arus-emas-and-disable-mentors.ts [--apply]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

async function run() {
  const apply = process.argv.includes("--apply");
  const sessions = await prisma.activitySession.findMany({
    where: { activity: { code: "PROKER" }, code: { startsWith: "ARUS_EMAS" } },
    select: { id: true },
  });
  const rows = await prisma.attendance.findMany({
    where: { sessionId: { in: sessions.map((s) => s.id) }, source: "MENTOR" },
  });
  const mentors = await prisma.user.findMany({ where: { role: "MENTOR", active: true }, select: { id: true, name: true, nrp: true } });
  console.log({ mentorArusEmasRows: rows.length, activeMentorsToDisable: mentors.length });
  if (!apply) {
    console.log("Dry run — tambahkan --apply untuk menjalankan.");
    return prisma.$disconnect();
  }

  const dir = path.join("backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-arus-emas-mentor-cleanup`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "attendances_arus_emas_by_mentor.json"), JSON.stringify(rows, null, 2));
  fs.writeFileSync(path.join(dir, "mentors_deactivated.json"), JSON.stringify(mentors, null, 2));

  const [deleted, disabled] = await prisma.$transaction(
    [
      prisma.attendance.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } }),
      prisma.user.updateMany({ where: { id: { in: mentors.map((m) => m.id) } }, data: { active: false } }),
    ],
  );
  console.log(`Dihapus ${deleted.count} baris kehadiran Arus Emas dari mentor; ${disabled.count} akun mentor dinonaktifkan. Backup: ${dir}`);
  await prisma.$disconnect();
}
run();
