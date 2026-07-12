import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function run() {
  const materials = await prisma.material.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      activity: { select: { code: true } }
    }
  });
  console.log("Current materials in DB:", materials.length);
  for (const m of materials) {
    console.log(`- [${m.activity.code}] ${m.name} (code: ${m.code}, ID: ${m.id})`);
  }
  await prisma.$disconnect();
}

run();
