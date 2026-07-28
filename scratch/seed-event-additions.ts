/**
 * One-off, idempotent backfill for the Inclenation event-scoring feature
 * (Terbaik/Terdisiplin/Terkompak). Adds the 5 new Materials/Parameters under
 * the existing INCLENATION activity + 1 demo `event1` account.
 *
 * Deliberately NOT importing from prisma/seed.ts — that file's `main()` runs
 * unconditionally on import and deletes nearly every table. This script only
 * ever creates/upserts brand-new rows; it never deletes anything, so it's
 * safe to run against the live, already-populated database.
 *
 * Usage: npx tsx scratch/seed-event-additions.ts
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { ParameterType, InputMethod, Role } from "../app/generated/prisma/enums";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "gradaks2026";

type SeedParam = {
  subCode: string;
  name: string;
  type: ParameterType;
  personalWeight: number | null;
  skillWeight: number | null;
  maxValue: number;
  inputMethod: InputMethod;
  order: number;
  clusterLabel?: string | null;
};

async function upsertMaterialWithParams(activityId: string, materialCode: string, materialName: string, materialOrder: number, params: SeedParam[]) {
  const material = await prisma.material.upsert({
    where: { activityId_code: { activityId, code: materialCode } },
    update: { name: materialName, order: materialOrder },
    create: { id: randomUUID(), activityId, code: materialCode, name: materialName, order: materialOrder },
  });

  for (const p of params) {
    await prisma.parameter.upsert({
      where: { materialId_subCode: { materialId: material.id, subCode: p.subCode } },
      update: {
        name: p.name,
        type: p.type,
        personalWeight: p.personalWeight,
        skillWeight: p.skillWeight,
        maxValue: p.maxValue,
        inputMethod: p.inputMethod,
        order: p.order,
        clusterLabel: p.clusterLabel ?? null,
      },
      create: {
        id: randomUUID(),
        materialId: material.id,
        subCode: p.subCode,
        name: p.name,
        type: p.type,
        personalWeight: p.personalWeight,
        skillWeight: p.skillWeight,
        maxValue: p.maxValue,
        inputMethod: p.inputMethod,
        order: p.order,
        clusterLabel: p.clusterLabel ?? null,
      },
    });
  }
  console.log(`- Material [${materialCode}] "${materialName}": ${params.length} parameter(s) upserted.`);
  return material;
}

async function run() {
  console.log("=== BACKFILL: Fitur Penilaian Event Inclenation ===");

  const inclenation = await prisma.activity.findUniqueOrThrow({ where: { code: "INCLENATION" } });
  console.log(`Activity INCLENATION ditemukan (id: ${inclenation.id}).`);

  await upsertMaterialWithParams(inclenation.id, "TERAKTIF", "Teraktif (Semakin Tinggi Semakin Baik)", 6, [
    { subCode: "TERAKTIF", name: "Keaktifan Bertanya/Menjawab", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 12, inputMethod: InputMethod.UNIT_MENTOR, order: 1 },
  ]);

  await upsertMaterialWithParams(inclenation.id, "TERDISIPLIN", "Terdisiplin (Semakin Tinggi Semakin Baik)", 7, [
    { subCode: "H1_KETAATAN", name: "Ketaatan Peraturan", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 5, inputMethod: InputMethod.UNIT_MENTOR, order: 1, clusterLabel: "Hari 1" },
    { subCode: "H1_KETEPATAN", name: "Ketepatan Jadwal Setiap Kegiatan", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 5, inputMethod: InputMethod.UNIT_MENTOR, order: 2, clusterLabel: "Hari 1" },
    { subCode: "H1_KESIGAPAN", name: "Paling Cepat Siap Setiap Kegiatan", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 5, inputMethod: InputMethod.UNIT_MENTOR, order: 3, clusterLabel: "Hari 1" },
    { subCode: "H2_KETAATAN", name: "Ketaatan Peraturan", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 5, inputMethod: InputMethod.UNIT_MENTOR, order: 4, clusterLabel: "Hari 2" },
    { subCode: "H2_KETEPATAN", name: "Ketepatan Jadwal Setiap Kegiatan", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 5, inputMethod: InputMethod.UNIT_MENTOR, order: 5, clusterLabel: "Hari 2" },
    { subCode: "H2_KESIGAPAN", name: "Paling Cepat Siap Setiap Kegiatan", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 5, inputMethod: InputMethod.UNIT_MENTOR, order: 6, clusterLabel: "Hari 2" },
  ]);

  await upsertMaterialWithParams(inclenation.id, "PELANGGARAN", "Pelanggaran (Semakin Tinggi Semakin Buruk) Akan Diminus", 8, [
    { subCode: "BERSERAKAN", name: "Buang Sampah Sembarangan", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 20, inputMethod: InputMethod.UNIT_MENTOR, order: 1 },
    { subCode: "ATRIBUT", name: "Atribut/Pakaian Tidak Sesuai", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 5, inputMethod: InputMethod.UNIT_MENTOR, order: 2 },
    { subCode: "TELAT", name: "Telat (Registrasi/Mobilisasi/Kegiatan)", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 20, inputMethod: InputMethod.UNIT_MENTOR, order: 3 },
    { subCode: "LAINNYA", name: "Pelanggaran Lainnya (ditentukan panitia)", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 20, inputMethod: InputMethod.UNIT_MENTOR, order: 4 },
  ]);

  await upsertMaterialWithParams(inclenation.id, "THRONE_BATTLE", "Winner Throne Battle (Event)", 9, [
    { subCode: "THRONE_BATTLE", name: "Winner Throne Battle", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 1, inputMethod: InputMethod.UNIT_EVENT, order: 1 },
  ]);

  await upsertMaterialWithParams(inclenation.id, "TERKOMPAK", "Terkompak (Event)", 10, [
    { subCode: "KERJASAMA_TIM", name: "Kerjasama Tim", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 1, inputMethod: InputMethod.REGION_EVENT, order: 1 },
    { subCode: "HAFAL_JARGON", name: "Semua Anggota Unit Hafal Jargon", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 1, inputMethod: InputMethod.REGION_EVENT, order: 2 },
    { subCode: "KOMPAK_JARGON", name: "Kompak Saat Jargon", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 1, inputMethod: InputMethod.REGION_EVENT, order: 3 },
    { subCode: "BAGUS_JARGON", name: "Jargon Bagus", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 1, inputMethod: InputMethod.REGION_EVENT, order: 4 },
    { subCode: "WARNA_DC_MIRIP", name: "Warna Dresscode Mirip", type: ParameterType.F, personalWeight: null, skillWeight: null, maxValue: 1, inputMethod: InputMethod.REGION_EVENT, order: 5 },
  ]);

  const existingEvent = await prisma.user.findUnique({ where: { nrp: "event1" } });
  if (existingEvent) {
    console.log("Akun demo 'event1' sudah ada, tidak diubah.");
  } else {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await prisma.user.create({
      data: {
        id: randomUUID(),
        nrp: "event1",
        name: "Panitia Event Inclenation",
        role: Role.EVENT,
        passwordHash,
        regionId: null,
        unitId: null,
      },
    });
    console.log(`Akun demo 'event1' dibuat (password: ${DEMO_PASSWORD}).`);
  }

  console.log("\n=== BACKFILL SELESAI — tidak ada data lama yang dihapus/diubah. ===");
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
