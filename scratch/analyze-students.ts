import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function analyze() {
  console.log("=== DETAILED IMPORT vs DB COMPARISON ===");

  // Fetch the latest STUDENT import batch
  const latestStudentImport = await prisma.import.findFirst({
    where: { type: "STUDENTS" },
    orderBy: { createdAt: "desc" },
    include: {
      rows: {
        select: {
          matchedStudentId: true,
          rawData: true,
          action: true,
          errorReason: true,
        },
      },
    },
  });

  if (!latestStudentImport) {
    console.log("No STUDENT import batch found.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Latest Import Batch ID: ${latestStudentImport.id}`);
  console.log(`Latest Import Batch Date: ${latestStudentImport.createdAt.toISOString()}`);
  console.log(`Total Rows in Latest Import CSV: ${latestStudentImport.rows.length}`);

  const actionsCount: Record<string, number> = {};
  const importedStudentIds = new Set<string>();

  for (const row of latestStudentImport.rows) {
    actionsCount[row.action] = (actionsCount[row.action] || 0) + 1;
    if (row.matchedStudentId) {
      importedStudentIds.add(row.matchedStudentId);
    }
  }

  console.log("Latest Import Row Actions:", actionsCount);

  // All students in DB
  const allStudents = await prisma.student.findMany({
    select: {
      id: true,
      nrp: true,
      name: true,
      createdAt: true,
      unit: { select: { code: true } },
      department: { select: { code: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Total Students in DB: ${allStudents.length}`);

  // Find students in DB that were NOT in this latest import batch
  const unreferencedStudents = allStudents.filter((s) => !importedStudentIds.has(s.id));
  console.log(`\n=== STUDENTS IN DB NOT IN LATEST IMPORT (${unreferencedStudents.length} students) ===`);
  unreferencedStudents.forEach((s, i) => {
    console.log(
      `${i + 1}. ID: ${s.id} | NRP: ${s.nrp} | Name: ${s.name} | Unit: ${s.unit?.code} | Dept: ${s.department?.code} | CreatedAt: ${s.createdAt.toISOString()}`
    );
  });

  await prisma.$disconnect();
}

analyze().catch(console.error);
