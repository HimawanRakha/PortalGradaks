import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";
dotenv.config();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function run() {
  const unit = await prisma.unit.findFirst({ where: { name: "Perm" }, select: { id: true, name: true } });
  if (!unit) { console.log("Unit not found"); return; }

  const students = await prisma.student.findMany({ where: { unitId: unit.id }, select: { id: true, nrp: true, name: true, active: true } });
  console.log(`Unit "${unit.name}" has ${students.length} total students (active+inactive):`, students.map(s => `${s.name} (${s.nrp}, active=${s.active})`));

  const studentIds = students.map(s => s.id);
  const recentAttendance = await prisma.attendance.findMany({
    where: { studentId: { in: studentIds } },
    include: { session: { include: { activity: true } }, student: { select: { name: true, nrp: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  console.log("\nMost recent attendance records for this unit:");
  for (const a of recentAttendance) {
    console.log(`  ${a.student.name} (${a.student.nrp}) — ${a.session.activity.code} ${a.session.code} — ${a.status} — updated ${a.updatedAt.toISOString()}`);
  }

  await prisma.$disconnect();
}
run();
