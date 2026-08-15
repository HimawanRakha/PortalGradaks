/**
 * Additive-only backfill for the attendance-gate + recommendation-engine
 * feature — deliberately NOT prisma/seed.ts, which deleteMany()s students/
 * users/imports/etc. This script only touches: the 5 existing TEMU_*
 * activities (sets isTemuFteic), the 3 new Setting keys (upsert), and
 * RecommendationRule (create-if-empty). Safe to re-run.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { RecommendationMetric, RuleOperator } from "../app/generated/prisma/enums";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TEMU_FTEIC_CODES = ["TEMU_0", "TEMU_1", "TEMU_2", "TEMU_3", "TEMU_3_1"];

const SETTING_KEYS = {
  temuAbsenceThreshold: "attendance.temuAbsenceThreshold",
  temuOfflineAbsenceThreshold: "attendance.temuOfflineAbsenceThreshold",
  dataInsufficientMessage: "attendance.dataInsufficientMessage",
};

const DATA_INSUFFICIENT_MESSAGE =
  "Data Anda tidak dapat diagregasi karena kekurangan kehadiran dan nilai, sehingga tidak masuk ke dalam pengolahan. Seluruh data pengembangan Anda akan diberikan kepada HMD untuk pengembangan lebih lanjut.";

async function run() {
  // 1. Flag the 5 existing Temu FTEIC activities
  const temuUpdate = await prisma.activity.updateMany({
    where: { code: { in: TEMU_FTEIC_CODES } },
    data: { isTemuFteic: true },
  });
  console.log(`Flagged ${temuUpdate.count} activities as isTemuFteic (expected 5).`);

  const flagged = await prisma.activity.findMany({ where: { isTemuFteic: true }, select: { code: true, name: true } });
  console.log("Now flagged:", flagged);

  // 2. Upsert the 3 new settings (only if they don't already exist, so re-runs don't clobber PSDM edits)
  const existingKeys = new Set(
    (await prisma.setting.findMany({ where: { key: { in: Object.values(SETTING_KEYS) } }, select: { key: true } })).map((s) => s.key),
  );

  if (!existingKeys.has(SETTING_KEYS.temuAbsenceThreshold)) {
    await prisma.setting.create({ data: { key: SETTING_KEYS.temuAbsenceThreshold, value: 2 } });
    console.log("Created setting:", SETTING_KEYS.temuAbsenceThreshold, "= 2");
  }
  if (!existingKeys.has(SETTING_KEYS.temuOfflineAbsenceThreshold)) {
    await prisma.setting.create({ data: { key: SETTING_KEYS.temuOfflineAbsenceThreshold, value: 1 } });
    console.log("Created setting:", SETTING_KEYS.temuOfflineAbsenceThreshold, "= 1");
  }
  if (!existingKeys.has(SETTING_KEYS.dataInsufficientMessage)) {
    await prisma.setting.create({ data: { key: SETTING_KEYS.dataInsufficientMessage, value: DATA_INSUFFICIENT_MESSAGE } });
    console.log("Created setting:", SETTING_KEYS.dataInsufficientMessage);
  }

  // 3. Seed starter recommendation rules only if the table is currently empty
  //    (never overwrite PSDM's own edits on a re-run).
  const ruleCount = await prisma.recommendationRule.count();
  if (ruleCount === 0) {
    await prisma.recommendationRule.createMany({
      data: [
        {
          name: "Personal & Keahlian tinggi",
          metric: RecommendationMetric.PERSONAL_SCORE,
          operator: RuleOperator.GTE,
          value: 85,
          recommendationText: "Menunjukkan Perkembangan Sangat Baik",
          descriptionText: "Nilai Personal maba berada pada rentang sangat baik, menunjukkan keterlibatan dan perkembangan yang konsisten sepanjang program.",
          order: 1,
        },
        {
          name: "Personal cukup, perlu pendampingan",
          metric: RecommendationMetric.PERSONAL_SCORE,
          operator: RuleOperator.LT,
          value: 60,
          recommendationText: "Perlu Pendampingan Tambahan",
          descriptionText: "Nilai Personal maba masih di bawah standar yang diharapkan — disarankan pendampingan tambahan dari mentor.",
          order: 2,
        },
        {
          name: "Keahlian tinggi",
          metric: RecommendationMetric.SKILL_SCORE,
          operator: RuleOperator.GTE,
          value: 85,
          descriptionText: "Nilai Keahlian menonjol, berpotensi untuk dilibatkan lebih jauh di kegiatan/kepanitiaan sesuai minat.",
          order: 3,
        },
        {
          name: "Keahlian rendah",
          metric: RecommendationMetric.SKILL_SCORE,
          operator: RuleOperator.LT,
          value: 60,
          descriptionText: "Nilai Keahlian masih di bawah standar yang diharapkan pada rumpun minat yang diikuti.",
          order: 4,
        },
        {
          name: "Default — perkembangan baik",
          metric: RecommendationMetric.PERSONAL_SCORE,
          operator: RuleOperator.GTE,
          value: 60,
          recommendationText: "Menunjukkan Perkembangan Baik",
          order: 5,
        },
      ],
    });
    console.log("Seeded 5 starter recommendation rules.");
  } else {
    console.log(`RecommendationRule already has ${ruleCount} row(s) — skipped starter seeding.`);
  }

  await prisma.$disconnect();
}

run();
