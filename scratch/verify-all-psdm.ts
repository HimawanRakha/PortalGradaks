/**
 * Marks every active maba as VERIFIED on the PSDM verification layer (the
 * only gate finalization checks while the Damen layer is off), so PSDM can
 * finalize all raports at once. Maba already VERIFIED or REJECTED are left
 * untouched. Recorded under an ADMIN account (first active one, or --admin <nrp>).
 *
 *   npx tsx --conditions=react-server scratch/verify-all-psdm.ts [--admin <nrp>] [--apply]
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { Role, VerificationLayer, VerificationStatus } from "../app/generated/prisma/enums";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const adminNrp = args.includes("--admin") ? args[args.indexOf("--admin") + 1] : null;
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN, active: true, ...(adminNrp ? { nrp: adminNrp } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, nrp: true },
  });
  if (!admin) throw new Error("Akun ADMIN aktif tidak ditemukan.");

  const students = await prisma.student.findMany({ where: { active: true }, select: { id: true, verifications: { where: { layer: VerificationLayer.PSDM } } } });
  const todo = students.filter((s) => s.verifications.length === 0 || s.verifications[0].status === VerificationStatus.PENDING);
  console.log(`maba aktif: ${students.length}, akan diverifikasi: ${todo.length}, dicatat atas nama: ${admin.name} (${admin.nrp ?? "-"})`);
  if (!apply) return console.log("dry run — tambahkan --apply untuk menyimpan");

  const now = new Date();
  let n = 0;
  for (const s of todo) {
    await prisma.verification.upsert({
      where: { studentId_layer: { studentId: s.id, layer: VerificationLayer.PSDM } },
      update: { status: VerificationStatus.VERIFIED, verifiedByUserId: admin.id, verifiedAt: now, note: "Verifikasi massal untuk finalisasi" },
      create: { studentId: s.id, layer: VerificationLayer.PSDM, status: VerificationStatus.VERIFIED, verifiedByUserId: admin.id, verifiedAt: now, note: "Verifikasi massal untuk finalisasi" },
    });
    n++;
  }
  const count = await prisma.verification.count({ where: { layer: VerificationLayer.PSDM, status: VerificationStatus.VERIFIED } });
  console.log(`diverifikasi: ${n}; total terverifikasi PSDM sekarang: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
