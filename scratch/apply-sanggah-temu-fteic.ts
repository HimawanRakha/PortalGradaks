/**
 * Masa sanggah Temu FTEIC: applies a CSV of corrected Temu FTEIC attendance
 * (columns nrp, session_code, status, arus_ke — arus_ke holds the session:
 * 1.0 / 1.1 / 2.0 / 3.0, where 3.0 is the single Temu FTEIC 3 session "3.1").
 *
 *   npx tsx --conditions=react-server scratch/apply-sanggah-temu-fteic.ts <csv> [--apply]
 *
 * Dry run by default. With --apply the rows it overwrites are saved to
 * backups/<stamp>-sanggah-temu-fteic/ and every write goes through
 * upsertAttendance (audit log).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma";
import { upsertAttendance } from "../lib/scoring/upsert";
import { computeScores } from "../lib/scoring/calculate";

const SESSION_BY_ARUS: Record<string, string> = { "1.0": "1.0", "1.1": "1.1", "2.0": "2.0", "3.0": "3.1", "3.1": "3.1", "0.0": "0.0" };

async function run() {
  const [csvPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const apply = process.argv.includes("--apply");
  const rows = parse(fs.readFileSync(csvPath, "utf8"), { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });
  const sessions = await prisma.activitySession.findMany({
    where: { activity: { attendanceCategory: "TEMU_FTEIC" }, code: { not: "UMUM" } },
    select: { id: true, code: true },
  });

  type Change = { nrp: string; studentId: string; session: string; sessionId: string; from: string | null; to: "HADIR" | "IZIN" | "ALPA" };
  const changes: Change[] = [];
  const problems: string[] = [];
  for (const [i, r] of rows.entries()) {
    const nrp = r.nrp;
    const status = r.status.toUpperCase();
    const code = SESSION_BY_ARUS[r.arus_ke];
    const session = sessions.find((s) => s.code === code);
    const student = await prisma.student.findUnique({ where: { nrp }, select: { id: true } });
    if (!student) { problems.push(`baris ${i + 2}: NRP ${nrp} tidak ditemukan`); continue; }
    if (!session) { problems.push(`baris ${i + 2}: sesi "${r.arus_ke}" tidak dikenal`); continue; }
    if (!["HADIR", "IZIN", "ALPA"].includes(status)) { problems.push(`baris ${i + 2}: status "${r.status}" tidak valid`); continue; }
    const from = (await prisma.attendance.findUnique({ where: { studentId_sessionId: { studentId: student.id, sessionId: session.id } } }))?.status ?? null;
    if (from !== status) changes.push({ nrp, studentId: student.id, session: code, sessionId: session.id, from, to: status as Change["to"] });
  }

  for (const c of changes) console.log(`${c.nrp} Temu ${c.session}: ${c.from ?? "kosong/ALPA"} -> ${c.to}`);
  console.log({ csvRows: rows.length, changes: changes.length, alreadyCorrect: rows.length - changes.length - problems.length, problems });
  if (!apply) {
    console.log("Dry run — tambahkan --apply untuk menerapkan.");
    return prisma.$disconnect();
  }

  const affected = [...new Set(changes.map((c) => c.studentId))];
  const before = new Map<string, boolean>();
  for (const id of affected) before.set(id, (await computeScores(id)).eligibility.eligible);

  const dir = path.join("backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-sanggah-temu-fteic`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "attendance_changes.json"), JSON.stringify(changes, null, 2));
  for (const c of changes) {
    await upsertAttendance({ studentId: c.studentId, sessionId: c.sessionId, status: c.to, participationScore: null, mode: "NA", actorUserId: admin.id, source: "IMPORT" });
  }

  let nowLayak = 0;
  let nowTidak = 0;
  for (const id of affected) {
    const after = (await computeScores(id)).eligibility.eligible;
    if (!before.get(id) && after) nowLayak++;
    if (before.get(id) && !after) nowTidak++;
  }
  console.log(`Diterapkan ${changes.length} perubahan untuk ${affected.length} maba. Jadi layak: ${nowLayak}, jadi tidak layak: ${nowTidak}. Backup: ${dir}`);
  await prisma.$disconnect();
}
run();
