/**
 * Finalizes RaportSnapshot for ONLY the two synthetic example students,
 * replicating finalizeRaportsAction's per-student logic exactly (same
 * imported functions) without touching the other 1300+ real students.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

import { computeScores } from "../lib/scoring/calculate";
import { getTemuAttendanceCounts } from "../lib/scoring/temu-attendance";
import { evaluateRecommendation, getActiveRecommendationRulesForEvaluation } from "../lib/scoring/recommendation";
import {
  SETTING_KEYS,
  DEFAULT_TEMU_ABSENCE_THRESHOLD,
  DEFAULT_TEMU_OFFLINE_ABSENCE_THRESHOLD,
  DEFAULT_DATA_INSUFFICIENT_MESSAGE,
} from "../lib/scoring/setting-keys";

const NRP_FULL = "CONTOH-PENUH";
const NRP_GATED = "CONTOH-GATE";

async function run() {
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!adminUser) throw new Error("No ADMIN user found.");

  const [temuAbsenceSetting, temuOfflineAbsenceSetting, msgSetting, activeRules] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.temuAbsenceThreshold } }),
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.temuOfflineAbsenceThreshold } }),
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.dataInsufficientMessage } }),
    getActiveRecommendationRulesForEvaluation(),
  ]);
  const temuAbsenceThreshold = typeof temuAbsenceSetting?.value === "number" ? temuAbsenceSetting.value : DEFAULT_TEMU_ABSENCE_THRESHOLD;
  const temuOfflineAbsenceThreshold =
    typeof temuOfflineAbsenceSetting?.value === "number" ? temuOfflineAbsenceSetting.value : DEFAULT_TEMU_OFFLINE_ABSENCE_THRESHOLD;
  const dataInsufficientMessage = typeof msgSetting?.value === "string" ? msgSetting.value : DEFAULT_DATA_INSUFFICIENT_MESSAGE;

  for (const nrp of [NRP_FULL, NRP_GATED]) {
    const student = await prisma.student.findUniqueOrThrow({ where: { nrp } });
    const computed = await computeScores(student.id);
    const personalScore = computed.personal.score ?? 0;
    const skillScore = computed.skill.score ?? 0;
    const { temuAbsences, temuOfflineAbsences } = await getTemuAttendanceCounts(student.id);
    const dataInsufficient = temuAbsences > temuAbsenceThreshold && temuOfflineAbsences > temuOfflineAbsenceThreshold;

    let recommendation: string;
    let description: string | null;
    if (dataInsufficient) {
      recommendation = "Tidak Dapat Diagregasi";
      description = dataInsufficientMessage;
    } else {
      const evaluated = evaluateRecommendation(computed, activeRules);
      recommendation = evaluated.recommendation;
      description = evaluated.description;
    }

    const breakdown = { ...computed, temuAttendance: { temuAbsences, temuOfflineAbsences } };

    await prisma.raportSnapshot.upsert({
      where: { studentId: student.id },
      update: { personalScore, skillScore, breakdown, recommendation, description, dataInsufficient, finalizedByUserId: adminUser.id, finalizedAt: new Date() },
      create: { studentId: student.id, personalScore, skillScore, breakdown, recommendation, description, dataInsufficient, finalizedByUserId: adminUser.id },
    });

    console.log(`\n=== ${nrp} (${student.name}) ===`);
    console.log("personalScore:", personalScore.toFixed(1), "| skillScore:", skillScore.toFixed(1));
    console.log("temuAbsences:", temuAbsences, "| temuOfflineAbsences:", temuOfflineAbsences, "| dataInsufficient:", dataInsufficient);
    console.log("recommendation:", recommendation);
    console.log("description:", description);
  }

  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
