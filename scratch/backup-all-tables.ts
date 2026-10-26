// Dumps every public table to backups/<timestamp>/<table>.json plus a
// row-count manifest — run before any schema/data change so nothing can be
// lost irrecoverably. Read-only against the DB.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function run() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join("backups", stamp);
  fs.mkdirSync(dir, { recursive: true });
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
  const manifest: Record<string, number> = {};
  for (const { table_name } of tables) {
    const rows = await prisma.$queryRawUnsafe<unknown[]>(`SELECT * FROM "${table_name}"`);
    fs.writeFileSync(path.join(dir, `${table_name}.json`), JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    manifest[table_name] = rows.length;
  }
  fs.writeFileSync(path.join(dir, "_manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(dir);
  console.log(manifest);
  await prisma.$disconnect();
}
run();
