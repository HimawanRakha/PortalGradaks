import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // pg.Pool defaults to max: 10 per instance. On Vercel, many concurrent
  // warm serverless instances each hold their own pool, so an unbounded
  // default multiplies fast against Neon Free's connection budget (the
  // pooler endpoint already absorbs most of this, but keeping each
  // instance's own pool small is cheap insurance).
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5 });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
