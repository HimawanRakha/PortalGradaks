/**
 * Masa sanggah raport (Logbook & Lainnya): applies PSDM's decisions for the
 * complaints in "Rekap Masa Sanggah Raport Maba - Logbook & Lainnya.csv".
 *
 * Rules agreed with PSDM:
 *  - Kegiatan keahlian claims are NOT recorded as kegiatan; instead the
 *    mentor evaluation of that category (Keaktifan/Minat/Potensi) is set to
 *    4/4 (so the category tops out at 80; Manajerial's 20% waits for the
 *    Penilaian Manajerial import).
 *  - Empty mentor values (logbook evaluation, Temu FTEIC Terakhir) are filled
 *    with the unit average of that same item.
 *  - Logbook entries still "perlu revisi"/"belum diverifikasi" -> LENGKAP.
 *  - Clear excuses -> IZIN; "hadir tapi ALPA" -> HADIR; kadep ban stays ALPA.
 *
 *   npx tsx --conditions=react-server scratch/apply-masa-sanggah.ts [--apply]
 *
 * Dry run by default. With --apply, every row it touches is first saved to
 * backups/<stamp>-masa-sanggah/ and all writes go through upsertScore /
 * upsertAttendance, so they also land in the audit log.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { upsertAttendance, upsertScore } from "../lib/scoring/upsert";

type Cat = "M" | "K" | "MB" | "KW";

const SKILL_TO_4: Array<[string, string, Cat[]]> = [
  ["SGH-030", "5053261013", ["MB"]],
  ["SGH-044", "5026261020", ["K"]],
  ["SGH-116", "5025261175", ["MB"]],
  ["SGH-122", "5025261256", ["KW"]],
  ["SGH-201", "5024261016", ["KW"]],
  ["SGH-207", "5022261150", ["M", "KW"]],
  ["SGH-221", "5025261060", ["K"]],
  ["SGH-273", "5026261059", ["K"]],
  ["SGH-276", "5022261114", ["K"]],
  ["SGH-288", "5027261053", ["KW"]],
  ["SGH-290", "5027261018", ["K"]],
  ["SGH-291", "5027261018", ["KW"]],
  ["SGH-304", "5026261039", ["KW"]],
  ["SGH-339", "5022261118", ["KW"]],
  ["SGH-418", "5025261029", ["K"]],
  ["SGH-468", "5054261034", ["MB"]],
  ["SGH-481", "5027261125", ["MB"]],
  ["SGH-488", "5025261207", ["MB", "M"]],
  ["SGH-502", "5026261002", ["MB"]],
  ["SGH-507", "5026261002", ["K"]],
  ["SGH-510", "5026261002", ["M"]],
  ["SGH-512", "5027261065", ["K", "M"]],
  ["SGH-513", "5026261002", ["KW"]],
];

const LOGBOOK_TO_LENGKAP: Array<[string, string]> = [
  ["SGH-043", "5025261089"],
  ["SGH-188", "5024261012"],
  ["SGH-251", "5025261119"],
  ["SGH-292", "5022261146"],
  ["SGH-298/356", "5025261242"],
  ["SGH-340", "5022261060"],
  ["SGH-347/480", "5022261033"],
  ["SGH-370", "5025261162"],
  ["SGH-386", "5024261019"],
  ["SGH-405", "5025261190"],
  ["SGH-466", "5027261009"],
  ["SGH-482", "5025261198"],
  ["SGH-492", "5024261001"],
];

/** Nilai keahlian 0 because the mentor never filled the logbook evaluation. */
const FILL_LOGBOOK_EVAL: Array<[string, string]> = [
  ["SGH-188", "5024261012"],
  ["SGH-251", "5025261119"],
  ["SGH-340", "5022261060"],
  ["SGH-370", "5025261162"],
  ["SGH-482", "5025261198"],
];

/** Temu FTEIC Terakhir: mark HADIR and fill the empty WUWE values. */
const FIX_TEMU_TERAKHIR: Array<[string, string]> = [
  ["SGH-340", "5022261060"],
  ["SGH-370", "5025261162"],
];

const ATTENDANCE: Array<[string, string, string[], "HADIR" | "IZIN"]> = [
  ["SGH-240", "5027261011", ["ARUS_EMAS_1", "ARUS_EMAS_2", "ARUS_EMAS_3"], "IZIN"], // sakit, surat dokter
  ["SGH-514", "5024261052", ["ARUS_EMAS_1", "ARUS_EMAS_2"], "IZIN"], // volunteer MAGE / magang tim riset
  ["SGH-356", "5025261242", ["ARUS_EMAS_1", "ARUS_EMAS_2"], "HADIR"], // ikut chant class (Arus Emas 1 & 2)
  ["SGH-192", "5025261238", ["PESRAF", "COMPEX"], "HADIR"], // dikonfirmasi PSDM: hadir di PESRAF & COMPEX saja
];

/** Claims for kegiatan that already exist in Kegiatan Keahlian: record the attendance there. */
const KEAHLIAN_ATTENDANCE: Array<[string, string, string]> = [
  ["SGH-221", "5025261060", "IBM_HACKTIV"],
  ["SGH-273", "5026261059", "IBM_HACKTIV"],
  ["SGH-339", "5022261118", "EG"],
];

async function run() {
  const apply = process.argv.includes("--apply");
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });

  const evalParams = await prisma.parameter.findMany({
    where: { material: { code: "LOGBOOK_EVAL" } },
    select: { id: true, subCode: true, name: true, maxValue: true, material: { select: { activityId: true } } },
  });
  const wuweParams = await prisma.parameter.findMany({
    where: { material: { code: "WUWE" } },
    select: { id: true, subCode: true, name: true, maxValue: true, material: { select: { activityId: true } } },
  });
  const umumOf = async (activityId: string) =>
    (await prisma.activitySession.findUniqueOrThrow({ where: { activityId_code: { activityId, code: "UMUM" } } })).id;
  const evalSession = await umumOf(evalParams[0].material.activityId);
  const wuweSession = await umumOf(wuweParams[0].material.activityId);
  const temuTerakhir = await prisma.activitySession.findFirstOrThrow({ where: { activityId: wuweParams[0].material.activityId, code: { not: "UMUM" } } });
  const besar = await prisma.activitySession.findMany({ where: { activity: { attendanceCategory: "KEGIATAN_BESAR" } }, select: { id: true, code: true } });

  const studentOf = async (nrp: string) =>
    prisma.student.findUniqueOrThrow({ where: { nrp }, select: { id: true, name: true, unitId: true } });

  type ScoreChange = { aduan: string; nrp: string; param: string; paramId: string; sessionId: string; studentId: string; from: number | null; to: number };
  const scoreChanges: ScoreChange[] = [];
  const unitAvgCache = new Map<string, number>();
  const unitAverage = async (unitId: string, paramId: string, sessionId: string) => {
    const key = `${unitId}:${paramId}`;
    if (!unitAvgCache.has(key)) {
      const vals = await prisma.score.findMany({
        where: { parameterId: paramId, sessionId, value: { gt: 0 }, student: { unitId } },
        select: { value: true },
      });
      const avg = vals.length ? vals.reduce((a, v) => a + (v.value ?? 0), 0) / vals.length : 3;
      unitAvgCache.set(key, Math.min(4, Math.max(1, Math.round(avg))));
    }
    return unitAvgCache.get(key)!;
  };
  const current = async (studentId: string, paramId: string, sessionId: string) =>
    (await prisma.score.findUnique({ where: { studentId_parameterId_sessionId: { studentId, parameterId: paramId, sessionId } } }))?.value ?? null;

  for (const [aduan, nrp, cats] of SKILL_TO_4) {
    const st = await studentOf(nrp);
    for (const p of evalParams.filter((x) => cats.includes(x.subCode.split("_")[0] as Cat))) {
      const from = await current(st.id, p.id, evalSession);
      if (from !== 4) scoreChanges.push({ aduan, nrp, param: p.name, paramId: p.id, sessionId: evalSession, studentId: st.id, from, to: 4 });
    }
  }
  for (const [aduan, nrp] of FILL_LOGBOOK_EVAL) {
    const st = await studentOf(nrp);
    for (const p of evalParams) {
      const from = await current(st.id, p.id, evalSession);
      if (from === null || from === 0) {
        scoreChanges.push({ aduan, nrp, param: p.name, paramId: p.id, sessionId: evalSession, studentId: st.id, from, to: await unitAverage(st.unitId, p.id, evalSession) });
      }
    }
  }
  for (const [aduan, nrp] of FIX_TEMU_TERAKHIR) {
    const st = await studentOf(nrp);
    for (const p of wuweParams) {
      const from = await current(st.id, p.id, wuweSession);
      if (from === null || from === 0) {
        scoreChanges.push({ aduan, nrp, param: p.name, paramId: p.id, sessionId: wuweSession, studentId: st.id, from, to: await unitAverage(st.unitId, p.id, wuweSession) });
      }
    }
  }

  type AttChange = { aduan: string; nrp: string; session: string; sessionId: string; studentId: string; from: string | null; to: "HADIR" | "IZIN" };
  const attChanges: AttChange[] = [];
  for (const [aduan, nrp, codes, to] of ATTENDANCE) {
    const st = await studentOf(nrp);
    for (const code of codes) {
      const s = besar.find((b) => b.code === code)!;
      const from = (await prisma.attendance.findUnique({ where: { studentId_sessionId: { studentId: st.id, sessionId: s.id } } }))?.status ?? null;
      if (from !== to) attChanges.push({ aduan, nrp, session: code, sessionId: s.id, studentId: st.id, from, to });
    }
  }
  const keahlianSessions = await prisma.activitySession.findMany({
    where: { activity: { attendanceCategory: "KEAHLIAN" } },
    select: { id: true, code: true },
  });
  for (const [aduan, nrp, code] of KEAHLIAN_ATTENDANCE) {
    const st = await studentOf(nrp);
    const s = keahlianSessions.find((k) => k.code === code)!;
    const from = (await prisma.attendance.findUnique({ where: { studentId_sessionId: { studentId: st.id, sessionId: s.id } } }))?.status ?? null;
    if (from !== "HADIR") attChanges.push({ aduan, nrp, session: code, sessionId: s.id, studentId: st.id, from, to: "HADIR" });
  }
  for (const [aduan, nrp] of FIX_TEMU_TERAKHIR) {
    const st = await studentOf(nrp);
    const from = (await prisma.attendance.findUnique({ where: { studentId_sessionId: { studentId: st.id, sessionId: temuTerakhir.id } } }))?.status ?? null;
    if (from !== "HADIR") attChanges.push({ aduan, nrp, session: temuTerakhir.code, sessionId: temuTerakhir.id, studentId: st.id, from, to: "HADIR" });
  }

  const logbookIds: string[] = [];
  const logbookPlan: string[] = [];
  for (const [aduan, nrp] of LOGBOOK_TO_LENGKAP) {
    const st = await studentOf(nrp);
    const entries = await prisma.logbookEntry.findMany({ where: { studentId: st.id, status: { not: "LENGKAP" } } });
    for (const e of entries) {
      logbookIds.push(e.id);
      logbookPlan.push(`${aduan} ${nrp} logbook "${e.periodLabel}": ${e.status} -> LENGKAP`);
    }
  }

  for (const c of scoreChanges) console.log(`${c.aduan} ${c.nrp} nilai "${c.param}": ${c.from ?? "kosong"} -> ${c.to}`);
  for (const c of attChanges) console.log(`${c.aduan} ${c.nrp} kehadiran ${c.session}: ${c.from ?? "kosong"} -> ${c.to}`);
  for (const l of logbookPlan) console.log(l);
  console.log({ scoreChanges: scoreChanges.length, attendanceChanges: attChanges.length, logbookChanges: logbookIds.length });
  if (!apply) {
    console.log("Dry run — tambahkan --apply untuk menerapkan.");
    return prisma.$disconnect();
  }

  const dir = path.join("backups", `${new Date().toISOString().replace(/[:.]/g, "-")}-masa-sanggah`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "score_changes.json"), JSON.stringify(scoreChanges, null, 2));
  fs.writeFileSync(path.join(dir, "attendance_changes.json"), JSON.stringify(attChanges, null, 2));
  fs.writeFileSync(
    path.join(dir, "logbook_entries_before.json"),
    JSON.stringify(await prisma.logbookEntry.findMany({ where: { id: { in: logbookIds } } }), null, 2),
  );

  for (const c of scoreChanges) {
    await upsertScore({ studentId: c.studentId, parameterId: c.paramId, sessionId: c.sessionId, value: c.to, actorUserId: admin.id, source: "MENTOR" });
  }
  for (const c of attChanges) {
    await upsertAttendance({ studentId: c.studentId, sessionId: c.sessionId, status: c.to, participationScore: null, mode: "NA", actorUserId: admin.id, source: "IMPORT" });
  }
  await prisma.logbookEntry.updateMany({
    where: { id: { in: logbookIds } },
    data: { status: "LENGKAP", verifiedByUserId: admin.id, verifiedAt: new Date(), note: "Disesuaikan PSDM (masa sanggah)" },
  });
  console.log(`Diterapkan. Backup: ${dir}`);
  await prisma.$disconnect();
}
run();
