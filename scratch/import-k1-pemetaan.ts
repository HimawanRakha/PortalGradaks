/**
 * Stores the Kuesioner 1 (Pemetaan Minat & Potensi) results per maba into
 * QuestionnaireStatus(code K1).raw.pemetaan — minat score per bidang (1-4),
 * rekam jejak level, validity (straight-liners excluded), minat dominan and
 * kuadran — so the raport conclusion can compare it with the GRADAKS result.
 * The existing raw keys are kept; a maba with a K1 answer but no K1 row gets
 * one (submitted). Every touched row is backed up first.
 *
 *   npx tsx --conditions=react-server scratch/import-k1-pemetaan.ts <k1_pemetaan.json> [--apply]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { QuestionnaireCode, type Prisma } from "../app/generated/prisma/client";

type Entry = { nrp: string; minat: Record<string, number>; rekamJejak: Record<string, number>; valid: boolean; minatDominan: string[]; kuadran: Record<string, string>; waktuIsi: string };

async function main() {
  const [file, flag] = process.argv.slice(2);
  const entries = JSON.parse(fs.readFileSync(file, "utf8")) as Entry[];
  const students = await prisma.student.findMany({ where: { nrp: { in: entries.map((e) => e.nrp) } }, select: { id: true, nrp: true } });
  const idByNrp = new Map(students.map((s) => [s.nrp, s.id]));
  const existing = await prisma.questionnaireStatus.findMany({ where: { code: QuestionnaireCode.K1, studentId: { in: students.map((s) => s.id) } } });
  const rowByStudent = new Map(existing.map((r) => [r.studentId, r]));
  const missing = entries.filter((e) => !idByNrp.has(e.nrp));
  const toCreate = entries.filter((e) => idByNrp.has(e.nrp) && !rowByStudent.has(idByNrp.get(e.nrp)!));
  console.log(`entri: ${entries.length}, NRP tidak ditemukan: ${missing.length}, baris K1 diperbarui: ${entries.length - missing.length - toCreate.length}, baris K1 baru: ${toCreate.length}`);
  if (flag !== "--apply") return console.log("dry run — tambahkan --apply untuk menyimpan");

  const dir = path.join("backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-k1-pemetaan`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "questionnaire_statuses_K1.json"), JSON.stringify(existing, null, 1));

  let n = 0;
  for (const e of entries) {
    const studentId = idByNrp.get(e.nrp);
    if (!studentId) continue;
    const { nrp, ...pemetaan } = e;
    const prev = rowByStudent.get(studentId);
    const base = prev?.raw && typeof prev.raw === "object" && !Array.isArray(prev.raw) ? (prev.raw as Record<string, unknown>) : { nrp };
    const raw = { ...base, pemetaan: { ...pemetaan, sumber: "Hasil Olahan Kuesioner Pemetaan Minat & Potensi Maba 2026" } } as Prisma.InputJsonValue;
    await prisma.questionnaireStatus.upsert({
      where: { studentId_code: { studentId, code: QuestionnaireCode.K1 } },
      update: { raw },
      create: { studentId, code: QuestionnaireCode.K1, submitted: true, submittedAt: new Date(e.waktuIsi.replace(" ", "T") + "+07:00"), raw },
    });
    n++;
  }
  console.log(`tersimpan: ${n} maba (backup: ${dir})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
