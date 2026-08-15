import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";
dotenv.config();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
async function run() {
  const res = await prisma.recommendationRule.deleteMany({ where: { name: "Test rule verifikasi" } });
  console.log("Deleted", res.count, "test rule(s).");
  await prisma.$disconnect();
}
run();
