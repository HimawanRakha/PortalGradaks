/**
 * Generates two temporary, clearly-fake students to demonstrate the two
 * raport scenarios (full score, and Temu FTEIC attendance-shortfall gate).
 * Uses the REAL production code paths (computeScores/getTemuAttendanceCounts/
 * evaluateRecommendation) so the example is representative, not a
 * reimplementation. Only touches brand-new synthetic records — never reads
 * or modifies any real student/account. Cleanup script removes everything
 * this creates.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { AttendanceStatus, SessionMode } from "../app/generated/prisma/enums";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const NRP_FULL = "CONTOH-PENUH";
const NRP_GATED = "CONTOH-GATE";

async function run() {
  const unit = await prisma.unit.findFirst({ select: { id: true, name: true } });
  if (!unit) throw new Error("No Unit found to attach test students to.");

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!adminUser) throw new Error("No ADMIN user found for finalizedByUserId.");

  const temuActivities = await prisma.activity.findMany({
    where: { isTemuFteic: true },
    include: { sessions: { where: { mode: { not: SessionMode.NA } } } },
    orderBy: { order: "asc" },
  });
  console.log(`Found ${temuActivities.length} Temu FTEIC activities with ${temuActivities.flatMap((a) => a.sessions).length} real sessions total.`);

  const parameters = await prisma.parameter.findMany({
    where: { active: true },
    include: { material: { select: { activityId: true } } },
  });
  console.log(`Found ${parameters.length} active parameters.`);

  // One UMUM session per activity referenced by these parameters, for scoring.
  const activityIds = Array.from(new Set(parameters.map((p) => p.material.activityId)));
  const umumSessions = await prisma.activitySession.findMany({
    where: { activityId: { in: activityIds }, code: "UMUM" },
  });
  const umumByActivity = new Map(umumSessions.map((s) => [s.activityId, s.id]));

  // Clean slate if a previous run left anything behind.
  await prisma.raportSnapshot.deleteMany({ where: { student: { nrp: { in: [NRP_FULL, NRP_GATED] } } } });
  await prisma.score.deleteMany({ where: { student: { nrp: { in: [NRP_FULL, NRP_GATED] } } } });
  await prisma.attendance.deleteMany({ where: { student: { nrp: { in: [NRP_FULL, NRP_GATED] } } } });
  await prisma.student.deleteMany({ where: { nrp: { in: [NRP_FULL, NRP_GATED] } } });

  const studentFull = await prisma.student.create({
    data: { nrp: NRP_FULL, name: "Contoh Maba (Nilai Penuh)", unitId: unit.id, active: true },
  });
  const studentGated = await prisma.student.create({
    data: { nrp: NRP_GATED, name: "Contoh Maba (Tidak Dapat Diagregasi)", unitId: unit.id, active: true },
  });
  console.log(`Created test students in unit "${unit.name}":`, studentFull.nrp, studentGated.nrp);

  // ---- Attendance ----
  // Full-score student: HADIR + max participation on every real Temu FTEIC session.
  for (const activity of temuActivities) {
    for (const session of activity.sessions) {
      await prisma.attendance.create({
        data: {
          studentId: studentFull.id,
          sessionId: session.id,
          status: AttendanceStatus.HADIR,
          participationScore: 4,
          mode: session.mode,
          source: "MENTOR",
        },
      });
    }
  }

  // Gated student: 3 Temu FTEIC absences total, 2 of them OFFLINE (trips the
  // >2 / >1 default thresholds), rest HADIR so real scores still compute.
  let offlineAbsencesGiven = 0;
  let totalAbsencesGiven = 0;
  for (const activity of temuActivities) {
    for (const session of activity.sessions) {
      const wantOfflineAbsence = session.mode === SessionMode.OFFLINE && offlineAbsencesGiven < 2;
      let status: (typeof AttendanceStatus)[keyof typeof AttendanceStatus];
      if (wantOfflineAbsence) {
        status = AttendanceStatus.ALPA;
        offlineAbsencesGiven++;
        totalAbsencesGiven++;
      } else if (totalAbsencesGiven < 3 && offlineAbsencesGiven >= 2) {
        status = AttendanceStatus.IZIN;
        totalAbsencesGiven++;
      } else {
        status = AttendanceStatus.HADIR;
      }
      await prisma.attendance.create({
        data: {
          studentId: studentGated.id,
          sessionId: session.id,
          status,
          participationScore: status === AttendanceStatus.HADIR ? 3 : null,
          mode: session.mode,
          source: "MENTOR",
        },
      });
    }
  }
  console.log(`Gated student: ${totalAbsencesGiven} total Temu FTEIC absences, ${offlineAbsencesGiven} of them offline.`);

  // ---- Scores ----
  // Full-score student: max value on every active parameter.
  for (const param of parameters) {
    const sessionId = umumByActivity.get(param.material.activityId);
    if (!sessionId) continue;
    await prisma.score.create({
      data: { studentId: studentFull.id, parameterId: param.id, sessionId, value: param.maxValue, source: "MENTOR" },
    });
  }

  // Gated student: moderate (not zero) scores, to show "nilai tetap tampil".
  for (const param of parameters) {
    const sessionId = umumByActivity.get(param.material.activityId);
    if (!sessionId) continue;
    const moderateValue = Math.max(1, Math.round(param.maxValue * 0.65));
    await prisma.score.create({
      data: { studentId: studentGated.id, parameterId: param.id, sessionId, value: moderateValue, source: "MENTOR" },
    });
  }

  console.log("Synthetic attendance + scores created for both test students.");
  console.log("adminUserId for finalization:", adminUser.id);
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
