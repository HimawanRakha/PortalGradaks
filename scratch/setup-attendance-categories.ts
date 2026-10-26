// One-off, idempotent data setup for the attendance-driven raport:
// tags activities with their AttendanceCategory, prepares the Kegiatan Besar
// sessions (Pesraf, Soscom, Arus Emas 1-3, Compex) + the SOSCOM sub-nilai
// parameters, and creates the Kegiatan Keahlian activity. Never deletes or
// overwrites any score/attendance row — only activities/sessions/materials/
// parameters metadata.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function ensureSession(activityId: string, code: string, name: string, mode: "OFFLINE" | "NA") {
  const existing = await prisma.activitySession.findUnique({ where: { activityId_code: { activityId, code } } });
  if (existing) return existing;
  return prisma.activitySession.create({ data: { id: randomUUID(), activityId, code, name, mode } });
}

async function run() {
  for (const code of ["TEMU_0", "TEMU_1", "TEMU_2", "TEMU_3"]) {
    await prisma.activity.update({ where: { code }, data: { attendanceCategory: "TEMU_FTEIC", isTemuFteic: true } });
  }
  await prisma.activity.update({ where: { code: "TEMU_2" }, data: { attendanceFromScores: true } });
  await prisma.activity.update({ where: { code: "INCLENATION" }, data: { attendanceCategory: "INCLENATION" } });

  const besar = await prisma.activity.update({
    where: { code: "PROKER" },
    data: { attendanceCategory: "KEGIATAN_BESAR", name: "Kegiatan Besar" },
  });

  // The pre-existing single ARUS_EMAS session becomes Arus Emas 1 — only
  // when it holds no attendance yet, so no imported row is ever re-pointed.
  const oldArus = await prisma.activitySession.findUnique({
    where: { activityId_code: { activityId: besar.id, code: "ARUS_EMAS" } },
    include: { _count: { select: { attendances: true, scores: true } } },
  });
  if (oldArus) {
    if (oldArus._count.attendances === 0 && oldArus._count.scores === 0) {
      await prisma.activitySession.update({ where: { id: oldArus.id }, data: { code: "ARUS_EMAS_1", name: "ARUS EMAS 1" } });
    } else {
      throw new Error(`ARUS_EMAS sudah punya ${oldArus._count.attendances} kehadiran — tidak diubah, cek manual.`);
    }
  }
  await ensureSession(besar.id, "PESRAF", "PESRAF", "OFFLINE");
  await ensureSession(besar.id, "SOSCOM", "SOSCOM", "OFFLINE");
  await ensureSession(besar.id, "ARUS_EMAS_1", "ARUS EMAS 1", "OFFLINE");
  await ensureSession(besar.id, "ARUS_EMAS_2", "ARUS EMAS 2", "OFFLINE");
  await ensureSession(besar.id, "ARUS_EMAS_3", "ARUS EMAS 3", "OFFLINE");
  await ensureSession(besar.id, "COMPEX", "COMPEX", "OFFLINE");
  await ensureSession(besar.id, "UMUM", "Umum", "NA");

  const soscom = await prisma.material.upsert({
    where: { activityId_code: { activityId: besar.id, code: "SOSCOM" } },
    update: {},
    create: { id: randomUUID(), activityId: besar.id, code: "SOSCOM", name: "SOSCOM", order: 1 },
  });
  const soscomParams = [
    { subCode: "C.1_SOSCOM", name: "Kreativitas (SOSCOM)", personalWeight: 0.1172, order: 1 },
    { subCode: "C.2_SOSCOM", name: "Kepekaan Sosial (SOSCOM)", personalWeight: 0.0476, order: 2 },
  ];
  for (const p of soscomParams) {
    await prisma.parameter.upsert({
      where: { materialId_subCode: { materialId: soscom.id, subCode: p.subCode } },
      update: {},
      create: { id: randomUUID(), materialId: soscom.id, type: "E", inputMethod: "IMPORT", maxValue: 10, ...p },
    });
  }

  const keahlian = await prisma.activity.upsert({
    where: { code: "KEAHLIAN" },
    update: { attendanceCategory: "KEAHLIAN" },
    create: {
      id: randomUUID(),
      code: "KEAHLIAN",
      name: "Kegiatan Keahlian",
      order: 90,
      isImportOnly: true,
      active: false, // hidden from mentors; still counted in the raport
      attendanceCategory: "KEAHLIAN",
    },
  });
  await ensureSession(keahlian.id, "UMUM", "Umum", "NA");

  const acts = await prisma.activity.findMany({
    orderBy: { order: "asc" },
    select: { code: true, name: true, active: true, attendanceCategory: true, attendanceFromScores: true, sessions: { select: { code: true } } },
  });
  console.dir(acts, { depth: 3 });
  await prisma.$disconnect();
}
run();
