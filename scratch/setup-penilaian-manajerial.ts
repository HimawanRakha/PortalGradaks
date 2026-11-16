// One-off, idempotent: creates the Penilaian Manajerial material + parameter
// (see MANAJERIAL_ASSESSMENT in lib/scoring/setting-keys.ts). Touches no score.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { MANAJERIAL_ASSESSMENT as M } from "../lib/scoring/setting-keys";

async function run() {
  const activity = await prisma.activity.findUniqueOrThrow({ where: { code: M.activityCode } });
  const material = await prisma.material.upsert({
    where: { activityId_code: { activityId: activity.id, code: M.materialCode } },
    update: {},
    create: { id: randomUUID(), activityId: activity.id, code: M.materialCode, name: "Penilaian Manajerial", order: 1 },
  });
  const param = await prisma.parameter.upsert({
    where: { materialId_subCode: { materialId: material.id, subCode: M.subCode } },
    update: {},
    create: {
      id: randomUUID(),
      materialId: material.id,
      subCode: M.subCode,
      name: "Penilaian Manajerial",
      type: "E",
      inputMethod: "IMPORT",
      maxValue: M.maxValue,
      order: 1,
    },
  });
  const umum = await prisma.activitySession.findUnique({ where: { activityId_code: { activityId: activity.id, code: "UMUM" } } });
  console.log({ material: material.code, parameter: param.subCode, maxValue: param.maxValue, umumSession: !!umum });
  await prisma.$disconnect();
}
run();
