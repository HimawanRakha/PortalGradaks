import "dotenv/config";
import fs from "node:fs";
import { prisma } from "../lib/prisma";
// Read-only: compares live table row counts against the latest backup manifest.
async function run() {
  const dir = fs.readdirSync("backups").sort().at(-1)!;
  const manifest = JSON.parse(fs.readFileSync(`backups/${dir}/_manifest.json`, "utf8")) as Record<string, number>;
  for (const [table, before] of Object.entries(manifest)) {
    const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*) AS n FROM "${table}"`);
    const after = Number(n);
    console.log(`${after < before ? "!! BERKURANG" : after > before ? "+ bertambah" : "  sama"}  ${table}: ${before} -> ${after}`);
  }
  await prisma.$disconnect();
}
run();
