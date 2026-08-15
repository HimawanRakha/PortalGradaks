import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function run() {
  const damenUsers = await prisma.user.findMany({
    where: { role: "DAMEN" },
    select: { id: true, name: true, nrp: true, unitId: true, regionId: true, active: true },
  });
  console.log(`DAMEN users: ${damenUsers.length}`);
  console.log(damenUsers);

  const verificationsByLayer = await prisma.verification.groupBy({
    by: ["layer", "status"],
    _count: true,
  });
  console.log("Verification rows by layer/status:", verificationsByLayer);

  await prisma.$disconnect();
}

run();
