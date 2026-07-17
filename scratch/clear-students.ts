import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

// Initialize DB connection using the same adapter PG setup as test-db.ts
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clearStudents() {
  console.log("=== MEMULAI PEMBERSIHAN DATA MAHASISWA BARU ===");

  try {
    // 1. Hitung data sebelum dihapus
    const studentCount = await prisma.student.count();
    console.log(`Menemukan ${studentCount} data mahasiswa baru.`);

    if (studentCount === 0) {
      console.log("Tidak ada data mahasiswa baru yang perlu dihapus.");
      return;
    }

    // 2. Hapus data di tabel-tabel anak yang mereferensikan Student
    console.log("Menghapus data terkait mahasiswa (Scores, Attendances, Logbooks, dll)...");

    // Urutan penghapusan untuk menghindari error Foreign Key constraint
    await prisma.raportSnapshot.deleteMany({});
    console.log("- Raport snapshots dihapus.");

    await prisma.verification.deleteMany({});
    console.log("- Verifications dihapus.");

    await prisma.flag.deleteMany({});
    console.log("- Flags dihapus.");

    await prisma.groupMember.deleteMany({});
    console.log("- Group members dihapus.");

    await prisma.groupScore.deleteMany({});
    console.log("- Group scores dihapus.");

    await prisma.group.deleteMany({});
    console.log("- Groups dihapus.");

    await prisma.score.deleteMany({});
    console.log("- Scores dihapus.");

    await prisma.attendance.deleteMany({});
    console.log("- Attendances dihapus.");

    await prisma.logbookEntry.deleteMany({});
    console.log("- Logbook entries dihapus.");

    await prisma.questionnaireStatus.deleteMany({});
    console.log("- Questionnaire statuses dihapus.");

    await prisma.personalityProfile.deleteMany({});
    console.log("- Personality profiles dihapus.");

    // Hapus baris riwayat impor yang bukan impor AKUN (agar riwayat impor akun tetap terjaga)
    await prisma.importRow.deleteMany({
      where: {
        import: {
          type: {
            not: "ACCOUNTS"
          }
        }
      }
    });
    await prisma.import.deleteMany({
      where: {
        type: {
          not: "ACCOUNTS"
        }
      }
    });
    console.log("- Riwayat impor data mahasiswa & aktivitas dihapus.");

    // 3. Hapus data mahasiswa itu sendiri
    await prisma.student.deleteMany({});
    console.log("- Seluruh data mahasiswa baru (students) BERHASIL dihapus.");

    console.log("\n=== PEMBERSIHAN SELESAI ===");
    console.log("Sekarang Anda dapat mengunggah CSV mahasiswa baru yang baru di menu Impor.");
  } catch (error) {
    console.error("Terjadi kesalahan saat menghapus data:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

clearStudents();
