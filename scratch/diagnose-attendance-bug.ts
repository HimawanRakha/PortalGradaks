import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";
dotenv.config();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const NRPS = ["5025261176", "5027261044", "5022261167", "5022261139"];

async function run() {
  const students = await prisma.student.findMany({
    where: { nrp: { in: NRPS } },
    select: { id: true, nrp: true, name: true, active: true, unitId: true, unit: { select: { name: true, mentor: { select: { nrp: true, active: true } } } } },
  });
  console.log("Students found:", JSON.stringify(students, null, 2));

  // Check for duplicate NRPs (case variations etc.)
  for (const nrp of NRPS) {
    const matches = await prisma.student.findMany({ where: { nrp: { equals: nrp, mode: "insensitive" } }, select: { id: true, nrp: true, active: true } });
    if (matches.length !== 1) console.log(`NRP ${nrp}: ${matches.length} matches (expected 1)`, matches);
  }

  await prisma.$disconnect();
}
run();
