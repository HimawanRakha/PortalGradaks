"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRole, getCurrentUser } from "@/lib/auth/dal";
import { Role, ImportType, ImportRowAction, LogbookStatus, VerificationLayer, VerificationStatus } from "@/app/generated/prisma/enums";
import { computeScores } from "@/lib/scoring/calculate";
import { upsertAttendance } from "@/lib/scoring/upsert";

type ActionResult = { ok: true; summary?: string } | { ok: false; error: string };

function parseCsv(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  return lines
    .map((line) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ""));
      return result;
    })
    .filter((row) => row.length > 0 && row.some((cell) => cell !== ""));
}

export async function importCsvAction(
  type: ImportType,
  fileName: string,
  csvContent: string,
): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.ADMIN);
    const parsed = parseCsv(csvContent);
    if (parsed.length <= 1) {
      return { ok: false, error: "CSV kosong atau hanya berisi header." };
    }

    const headers = parsed[0].map((h) => h.toLowerCase());
    const rows = parsed.slice(1);

    // Create the Import record first
    const batchImport = await prisma.import.create({
      data: {
        type,
        fileName,
        importedByUserId: user.id,
        totalRows: rows.length,
        matchedRows: 0,
        failedRows: 0,
      },
    });

    let matchedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed, +1 for header
      const dataMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        dataMap[h] = row[idx] || "";
      });

      const nrp = dataMap["nrp"]?.trim();
      if (!nrp) {
        failedCount++;
        await prisma.importRow.create({
          data: {
            importId: batchImport.id,
            rowNumber: rowNum,
            rawData: dataMap as any,
            action: ImportRowAction.FAILED,
            errorReason: "Kolom NRP kosong atau tidak ditemukan.",
          },
        });
        continue;
      }

      // Check if student exists
      const student = await prisma.student.findUnique({ where: { nrp } });
      if (!student) {
        failedCount++;
        await prisma.importRow.create({
          data: {
            importId: batchImport.id,
            rowNumber: rowNum,
            rawData: dataMap as any,
            action: ImportRowAction.SKIPPED_NO_MATCH,
            errorReason: `Tidak ditemukan mahasiswa dengan NRP "${nrp}".`,
          },
        });
        continue;
      }

      try {
        let action: ImportRowAction = ImportRowAction.CREATED;
        let previousValue: any = null;

        // Perform specific database updates depending on import type
        if (type === ImportType.PERSONALITY) {
          const mbtiType = dataMap["mbtitype"] || dataMap["mbti"] || null;
          const temperament = dataMap["temperament"] || null;

          const existing = await prisma.personalityProfile.findUnique({
            where: { studentId: student.id },
          });

          if (existing) {
            action = ImportRowAction.UPDATED;
            previousValue = { mbtiType: existing.mbtiType, temperament: existing.temperament };
            await prisma.personalityProfile.update({
              where: { studentId: student.id },
              data: { mbtiType, temperament, importId: batchImport.id },
            });
          } else {
            await prisma.personalityProfile.create({
              data: { studentId: student.id, mbtiType, temperament, importId: batchImport.id },
            });
          }
        } 
        else if (type === ImportType.BASELINE_K1 || type === ImportType.REFLECTION_K2) {
          const code = type === ImportType.BASELINE_K1 ? "K1" : "K2";
          const submitted = dataMap["submitted"]?.toLowerCase() === "true" || dataMap["submitted"] === "1" || true;

          const existing = await prisma.questionnaireStatus.findUnique({
            where: { studentId_code: { studentId: student.id, code } },
          });

          if (existing) {
            action = ImportRowAction.UPDATED;
            previousValue = { submitted: existing.submitted, submittedAt: existing.submittedAt };
            await prisma.questionnaireStatus.update({
              where: { studentId_code: { studentId: student.id, code } },
              data: { submitted, submittedAt: new Date(), importId: batchImport.id },
            });
          } else {
            await prisma.questionnaireStatus.create({
              data: { studentId: student.id, code, submitted, submittedAt: new Date(), importId: batchImport.id },
            });
          }
        } 
        else if (type === ImportType.LOGBOOK) {
          const periodLabel = dataMap["periodlabel"] || dataMap["period"] || "Umum";
          const content = dataMap["content"] || "";

          // Creating multiple logbooks is allowed, but prevent exact duplicates for period
          const existing = await prisma.logbookEntry.findFirst({
            where: { studentId: student.id, periodLabel },
          });

          if (existing) {
            action = ImportRowAction.UPDATED;
            previousValue = { content: existing.content, status: existing.status };
            await prisma.logbookEntry.update({
              where: { id: existing.id },
              data: { content, status: LogbookStatus.BELUM_DIVERIFIKASI, importId: batchImport.id },
            });
          } else {
            await prisma.logbookEntry.create({
              data: {
                studentId: student.id,
                periodLabel,
                content,
                status: LogbookStatus.BELUM_DIVERIFIKASI,
                importId: batchImport.id,
              },
            });
          }
        } 
        else if (type === ImportType.PROKER) {
          const sessionCode = dataMap["prokercode"] || dataMap["sessioncode"] || "";
          const statusVal = (dataMap["status"] || "HADIR").toUpperCase();

          const prokerActivity = await prisma.activity.findUnique({ where: { code: "PROKER" } });
          if (!prokerActivity) throw new Error("Kegiatan PROKER tidak ditemukan di database.");

          const session = await prisma.activitySession.findFirst({
            where: { activityId: prokerActivity.id, code: sessionCode.toUpperCase().trim() },
          });

          if (!session) {
            throw new Error(`Sesi Proker "${sessionCode}" tidak ditemukan di database.`);
          }

          // Use the secure upsertAttendance helper
          await upsertAttendance({
            studentId: student.id,
            sessionId: session.id,
            status: statusVal as any,
            participationScore: statusVal === "HADIR" ? 4 : null, // Default full score for external imported attendance
            mode: session.mode,
            actorUserId: user.id,
            source: "IMPORT",
          });
        }

        matchedCount++;
        await prisma.importRow.create({
          data: {
            importId: batchImport.id,
            rowNumber: rowNum,
            matchedStudentId: student.id,
            rawData: dataMap as any,
            action,
            previousValueSnapshot: previousValue ? (previousValue as any) : undefined,
          },
        });
      } catch (err) {
        failedCount++;
        await prisma.importRow.create({
          data: {
            importId: batchImport.id,
            rowNumber: rowNum,
            matchedStudentId: student.id,
            rawData: dataMap as any,
            action: ImportRowAction.FAILED,
            errorReason: err instanceof Error ? err.message : "Kesalahan pengolahan baris.",
          },
        });
      }
    }

    // Update Import log counts
    await prisma.import.update({
      where: { id: batchImport.id },
      data: {
        matchedRows: matchedCount,
        failedRows: failedCount,
      },
    });

    revalidatePath("/admin/imports");
    return { ok: true, summary: `Impor selesai: ${matchedCount} baris berhasil diproses, ${failedCount} baris gagal.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mengimpor file." };
  }
}

export async function verifyPsdmLayerAction(
  studentId: string,
  status: "VERIFIED" | "REJECTED",
  note: string,
): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.ADMIN);

    await prisma.verification.upsert({
      where: { studentId_layer: { studentId, layer: VerificationLayer.PSDM } },
      update: {
        status: status as VerificationStatus,
        note: note || null,
        verifiedByUserId: user.id,
        verifiedAt: new Date(),
      },
      create: {
        studentId,
        layer: VerificationLayer.PSDM,
        status: status as VerificationStatus,
        note: note || null,
        verifiedByUserId: user.id,
        verifiedAt: new Date(),
      },
    });

    revalidatePath("/admin/verification");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan verifikasi." };
  }
}

export async function finalizeRaportsAction(): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.ADMIN);

    // Fetch all active students
    const students = await prisma.student.findMany({
      where: { active: true },
      select: { id: true, nrp: true, name: true },
    });

    let successCount = 0;

    for (const student of students) {
      // Calculate scores on-the-fly using the math engine
      const computed = await computeScores(student.id);

      const personalScore = computed.personal.score !== null ? computed.personal.score : 0;
      const skillScore = computed.skill.score !== null ? computed.skill.score : 0;

      // Determine recommendation (Pass/Fail criteria)
      const isAttendanceFailed = computed.personal.items.some(
        (item) => item.refCode === "ATTENDANCE" && item.normalizedValue < 70
      );
      
      const isMarsFailed = computed.personal.items.some(
        (item) => item.refCode === "MARS_ELECTICS" && item.rawValue < 70 // default mars pass score is 70
      );

      let recommendation = "LULUS";
      if (isAttendanceFailed || isMarsFailed) {
        recommendation = "TIDAK LULUS (Gagal kriteria minimum kehadiran atau mars)";
      } else if (personalScore < 60 || skillScore < 60) {
        recommendation = "LULUS DENGAN EVALUASI";
      }

      await prisma.raportSnapshot.upsert({
        where: { studentId: student.id },
        update: {
          personalScore,
          skillScore,
          breakdown: computed as any,
          recommendation,
          finalizedByUserId: user.id,
          finalizedAt: new Date(),
        },
        create: {
          studentId: student.id,
          personalScore,
          skillScore,
          breakdown: computed as any,
          recommendation,
          finalizedByUserId: user.id,
        },
      });

      successCount++;
    }

    revalidatePath("/admin/finalization");
    return { ok: true, summary: `Finalisasi sukses. Berhasil membekukan nilai untuk ${successCount} maba.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal melakukan finalisasi raport." };
  }
}
