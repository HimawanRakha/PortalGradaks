import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function run() {
  const migTable = await prisma.$queryRaw<Array<{ exists: string | null }>>`SELECT to_regclass('public._prisma_migrations')::text as exists`;
  const [students, users, scores, attendances, snapshots, imports, activities] = await Promise.all([
    prisma.student.count(),
    prisma.user.count(),
    prisma.score.count(),
    prisma.attendance.count(),
    prisma.raportSnapshot.count(),
    prisma.import.count(),
    prisma.activity.count(),
  ]);

  console.log("_prisma_migrations table exists:", migTable[0]?.exists ?? "null (does not exist)");
  console.log({ students, users, scores, attendances, snapshots, imports, activities });

  const recentImports = await prisma.import.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { type: true, fileName: true, createdAt: true, totalRows: true },
  });
  console.log("Recent imports:", recentImports);

  await prisma.$disconnect();
}

run();
