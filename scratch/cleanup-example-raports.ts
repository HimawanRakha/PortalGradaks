import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";
dotenv.config();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const NRPS = ["CONTOH-PENUH", "CONTOH-GATE"];

async function run() {
  const students = await prisma.student.findMany({ where: { nrp: { in: NRPS } }, select: { id: true, nrp: true } });
  const ids = students.map((s) => s.id);
  const snap = await prisma.raportSnapshot.deleteMany({ where: { studentId: { in: ids } } });
  const scores = await prisma.score.deleteMany({ where: { studentId: { in: ids } } });
  const att = await prisma.attendance.deleteMany({ where: { studentId: { in: ids } } });
  const stu = await prisma.student.deleteMany({ where: { id: { in: ids } } });
  console.log({ found: students.map(s => s.nrp), deletedSnapshots: snap.count, deletedScores: scores.count, deletedAttendance: att.count, deletedStudents: stu.count });

  // Confirm nothing with these NRPs remains
  const remaining = await prisma.student.count({ where: { nrp: { in: NRPS } } });
  console.log("Remaining students with these NRPs (should be 0):", remaining);

  await prisma.$disconnect();
}
run();
