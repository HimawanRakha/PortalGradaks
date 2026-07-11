"use server";

import { revalidatePath } from "next/cache";
import { parse } from "csv-parse/sync";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import {
  Role,
  ImportType,
  ImportRowAction,
  AttendanceStatus,
  LogbookStatus,
  VerificationLayer,
  VerificationStatus,
} from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";
import { computeScores } from "@/lib/scoring/calculate";
import { SETTING_KEYS } from "@/lib/scoring/setting-keys";
import { upsertAttendance, upsertScore } from "@/lib/scoring/upsert";

type ActionResult = { ok: true; summary?: string } | { ok: false; error: string };

type RowOutcome = {
  action: ImportRowAction;
  matchedStudentId?: string;
  previousValueSnapshot?: Prisma.InputJsonValue;
  errorReason?: string;
};

const ATTENDANCE_STATUSES = new Set<string>([AttendanceStatus.HADIR, AttendanceStatus.IZIN, AttendanceStatus.ALPA]);
const VALID_ROLES = new Set<string>([Role.ADMIN, Role.KEPALA_REGION, Role.MENTOR, Role.DAMEN]);

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["true", "1", "yes", "ya", "y"].includes(value.trim().toLowerCase());
}

async function importStudentsRow(dataMap: Record<string, string>): Promise<RowOutcome> {
  const nrp = dataMap["nrp"]?.trim();
  const name = dataMap["name"]?.trim();
  const unitCode = dataMap["unit_code"]?.trim();
  const departmentCode = dataMap["department_code"]?.trim();

  if (!name || !unitCode) {
    return { action: ImportRowAction.FAILED, errorReason: "Kolom name/unit_code wajib diisi." };
  }

  const unit = await prisma.unit.findUnique({ where: { code: unitCode } });
  if (!unit) {
    return { action: ImportRowAction.FAILED, errorReason: `Unit dengan kode "${unitCode}" tidak ditemukan.` };
  }

  let departmentId: string | null = null;
  if (departmentCode) {
    const department = await prisma.department.findUnique({ where: { code: departmentCode } });
    if (!department) {
      return { action: ImportRowAction.FAILED, errorReason: `Departemen dengan kode "${departmentCode}" tidak ditemukan.` };
    }
    departmentId = department.id;
  }

  const existing = await prisma.student.findUnique({ where: { nrp } });
  if (existing) {
    await prisma.student.update({
      where: { id: existing.id },
      data: { name, unitId: unit.id, departmentId },
    });
    return {
      action: ImportRowAction.UPDATED,
      matchedStudentId: existing.id,
      previousValueSnapshot: { name: existing.name, unitId: existing.unitId, departmentId: existing.departmentId },
    };
  }

  const created = await prisma.student.create({
    data: { nrp, name, unitId: unit.id, departmentId },
  });
  return { action: ImportRowAction.CREATED, matchedStudentId: created.id };
}

async function importAccountsRow(dataMap: Record<string, string>): Promise<RowOutcome> {
  const nrp = dataMap["nrp"]?.trim();
  const name = dataMap["name"]?.trim();
  const roleRaw = dataMap["role"]?.trim().toUpperCase();
  const unitCode = dataMap["unit_code"]?.trim();
  const regionCode = dataMap["region_code"]?.trim();
  const password = dataMap["password"];

  if (!name || !roleRaw || !VALID_ROLES.has(roleRaw)) {
    return { action: ImportRowAction.FAILED, errorReason: `Kolom role harus salah satu dari ${Array.from(VALID_ROLES).join(", ")}.` };
  }
  if (!password || password.length < 6) {
    return { action: ImportRowAction.FAILED, errorReason: "Password wajib diisi, minimal 6 karakter." };
  }

  const existingUser = await prisma.user.findUnique({ where: { nrp } });
  if (existingUser) {
    // Never silently overwrite an existing login's password via bulk import — use the
    // dedicated reset-password action in Master Data > Akun for that instead.
    return { action: ImportRowAction.SKIPPED_DUPLICATE, errorReason: `Akun dengan NRP "${nrp}" sudah ada — gunakan reset password di Master Data.` };
  }

  let unitId: string | null = null;
  if (roleRaw === Role.MENTOR) {
    if (!unitCode) return { action: ImportRowAction.FAILED, errorReason: "Mentor wajib memiliki unit_code." };
    const unit = await prisma.unit.findUnique({ where: { code: unitCode } });
    if (!unit) return { action: ImportRowAction.FAILED, errorReason: `Unit "${unitCode}" tidak ditemukan.` };
    if (unit.id) {
      const taken = await prisma.user.findUnique({ where: { unitId: unit.id } });
      if (taken) return { action: ImportRowAction.FAILED, errorReason: `Unit "${unitCode}" sudah punya mentor.` };
    }
    unitId = unit.id;
  }

  let regionId: string | null = null;
  if (roleRaw === Role.KEPALA_REGION) {
    if (!regionCode) return { action: ImportRowAction.FAILED, errorReason: "Kepala Region wajib memiliki region_code." };
    const region = await prisma.region.findUnique({ where: { code: regionCode } });
    if (!region) return { action: ImportRowAction.FAILED, errorReason: `Region "${regionCode}" tidak ditemukan.` };
    regionId = region.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  // Note: matchedStudentId is deliberately left unset — this row creates a
  // User, not a Student, so ImportRow's Student FK doesn't apply here.
  await prisma.user.create({
    data: { nrp, name, role: roleRaw as Role, passwordHash, unitId, regionId },
  });
  return { action: ImportRowAction.CREATED };
}

async function importPersonalityRow(dataMap: Record<string, string>, studentId: string, importId: string): Promise<RowOutcome> {
  const mbtiType = dataMap["mbtitype"] || dataMap["mbti"] || dataMap["mbti_type"] || null;
  const temperament = dataMap["temperament"] || null;

  const existing = await prisma.personalityProfile.findUnique({ where: { studentId } });
  if (existing) {
    await prisma.personalityProfile.update({
      where: { studentId },
      data: { mbtiType, temperament, importId },
    });
    return {
      action: ImportRowAction.UPDATED,
      matchedStudentId: studentId,
      previousValueSnapshot: { mbtiType: existing.mbtiType, temperament: existing.temperament },
    };
  }
  await prisma.personalityProfile.create({ data: { studentId, mbtiType, temperament, importId } });
  return { action: ImportRowAction.CREATED, matchedStudentId: studentId };
}

async function importQuestionnaireRow(
  dataMap: Record<string, string>,
  studentId: string,
  importId: string,
  code: "K1" | "K2",
): Promise<RowOutcome> {
  const submitted = truthy(dataMap["submitted"]);
  const existing = await prisma.questionnaireStatus.findUnique({ where: { studentId_code: { studentId, code } } });

  if (existing) {
    await prisma.questionnaireStatus.update({
      where: { studentId_code: { studentId, code } },
      data: { submitted, submittedAt: submitted ? new Date() : existing.submittedAt, raw: dataMap, importId },
    });
    return {
      action: ImportRowAction.UPDATED,
      matchedStudentId: studentId,
      previousValueSnapshot: { submitted: existing.submitted, submittedAt: existing.submittedAt?.toISOString() ?? null },
    };
  }
  await prisma.questionnaireStatus.create({
    data: { studentId, code, submitted, submittedAt: submitted ? new Date() : null, raw: dataMap, importId },
  });
  return { action: ImportRowAction.CREATED, matchedStudentId: studentId };
}

async function importLogbookRow(dataMap: Record<string, string>, studentId: string, importId: string): Promise<RowOutcome> {
  const periodLabel = dataMap["period_label"] || dataMap["periodlabel"] || "Umum";
  const content = dataMap["content"] || "";
  // Logbook entries are additive/periodic (a mentor verifies each one afterward),
  // not upserted — a corrective re-upload for the same period still creates a new
  // entry rather than silently rewriting what a mentor may have already reviewed.
  await prisma.logbookEntry.create({
    data: { studentId, periodLabel, content, status: LogbookStatus.BELUM_DIVERIFIKASI, importId },
  });
  return { action: ImportRowAction.CREATED, matchedStudentId: studentId };
}

async function importProkerRow(dataMap: Record<string, string>, studentId: string, actorUserId: string, importId: string): Promise<RowOutcome> {
  const sessionCode = (dataMap["session_code"] || dataMap["prokercode"] || dataMap["proker_code"] || "").toUpperCase().trim();
  const statusRaw = (dataMap["status"] || "").toUpperCase().trim();

  if (!ATTENDANCE_STATUSES.has(statusRaw)) {
    return { action: ImportRowAction.FAILED, errorReason: `Status "${statusRaw}" tidak valid (harus HADIR/IZIN/ALPA).` };
  }

  const session = await prisma.activitySession.findFirst({
    where: { activity: { code: "PROKER" }, code: sessionCode },
  });
  if (!session) {
    return { action: ImportRowAction.FAILED, errorReason: `Sesi Proker "${sessionCode}" tidak ditemukan.` };
  }

  const existing = await prisma.attendance.findUnique({ where: { studentId_sessionId: { studentId, sessionId: session.id } } });
  await upsertAttendance({
    studentId,
    sessionId: session.id,
    status: statusRaw as AttendanceStatus,
    participationScore: null,
    mode: "NA",
    actorUserId,
    source: "IMPORT",
    importId,
  });

  return {
    action: existing ? ImportRowAction.UPDATED : ImportRowAction.CREATED,
    matchedStudentId: studentId,
    previousValueSnapshot: existing ? { status: existing.status } : undefined,
  };
}

async function importPostTestRow(dataMap: Record<string, string>, studentId: string, actorUserId: string, importId: string): Promise<RowOutcome> {
  const activityCode = dataMap["activity_code"]?.trim();
  const materialCode = dataMap["material_code"]?.trim();
  const subCode = dataMap["parameter_subcode"]?.trim();
  const valueRaw = dataMap["value"]?.trim();

  if (!activityCode || !materialCode || !subCode || valueRaw === undefined || valueRaw === "") {
    return { action: ImportRowAction.FAILED, errorReason: "Kolom activity_code/material_code/parameter_subcode/value wajib diisi." };
  }
  const value = Number(valueRaw);
  if (Number.isNaN(value)) {
    return { action: ImportRowAction.FAILED, errorReason: `Nilai "${valueRaw}" bukan angka.` };
  }

  const parameter = await prisma.parameter.findFirst({
    where: { subCode, material: { code: materialCode, activity: { code: activityCode } } },
  });
  if (!parameter) {
    return { action: ImportRowAction.FAILED, errorReason: `Parameter ${activityCode}/${materialCode}/${subCode} tidak ditemukan.` };
  }
  const session = await prisma.activitySession.findFirst({ where: { activity: { code: activityCode }, code: "UMUM" } });
  if (!session) {
    return { action: ImportRowAction.FAILED, errorReason: `Sesi UMUM untuk kegiatan "${activityCode}" tidak ditemukan.` };
  }

  const existing = await prisma.score.findUnique({
    where: { studentId_parameterId_sessionId: { studentId, parameterId: parameter.id, sessionId: session.id } },
  });
  await upsertScore({ studentId, parameterId: parameter.id, sessionId: session.id, value, actorUserId, source: "IMPORT", importId });

  return {
    action: existing ? ImportRowAction.UPDATED : ImportRowAction.CREATED,
    matchedStudentId: studentId,
    previousValueSnapshot: existing ? { value: existing.value } : undefined,
  };
}

export async function importCsvAction(type: ImportType, fileName: string, csvContent: string): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.ADMIN);

    let rows: Record<string, string>[];
    try {
      rows = parse(csvContent, {
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseError) {
      return { ok: false, error: `Gagal membaca CSV: ${parseError instanceof Error ? parseError.message : "format tidak valid"}.` };
    }
    if (rows.length === 0) {
      return { ok: false, error: "CSV kosong atau hanya berisi header." };
    }

    const batchImport = await prisma.import.create({
      data: { type, fileName, importedByUserId: user.id, totalRows: rows.length, matchedRows: 0, failedRows: 0 },
    });

    let matchedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const dataMap = rows[i];
      const rowNumber = i + 2; // 1-indexed, +1 for header row

      try {
        let outcome: RowOutcome;

        // STUDENTS and ACCOUNTS bootstrap records themselves — every other type
        // matches against an existing Student by NRP first.
        if (type === ImportType.STUDENTS) {
          outcome = await importStudentsRow(dataMap);
        } else if (type === ImportType.ACCOUNTS) {
          outcome = await importAccountsRow(dataMap);
        } else {
          const nrp = dataMap["nrp"]?.trim();
          if (!nrp) {
            outcome = { action: ImportRowAction.FAILED, errorReason: "Kolom nrp kosong atau tidak ditemukan." };
          } else {
            const student = await prisma.student.findUnique({ where: { nrp } });
            if (!student) {
              outcome = { action: ImportRowAction.SKIPPED_NO_MATCH, errorReason: `Tidak ditemukan maba dengan NRP "${nrp}".` };
            } else if (type === ImportType.PERSONALITY) {
              outcome = await importPersonalityRow(dataMap, student.id, batchImport.id);
            } else if (type === ImportType.BASELINE_K1) {
              outcome = await importQuestionnaireRow(dataMap, student.id, batchImport.id, "K1");
            } else if (type === ImportType.REFLECTION_K2) {
              outcome = await importQuestionnaireRow(dataMap, student.id, batchImport.id, "K2");
            } else if (type === ImportType.LOGBOOK) {
              outcome = await importLogbookRow(dataMap, student.id, batchImport.id);
            } else if (type === ImportType.PROKER) {
              outcome = await importProkerRow(dataMap, student.id, user.id, batchImport.id);
            } else if (type === ImportType.POST_TEST) {
              outcome = await importPostTestRow(dataMap, student.id, user.id, batchImport.id);
            } else {
              outcome = { action: ImportRowAction.FAILED, errorReason: `Jenis impor "${type}" belum didukung.` };
            }
          }
        }

        if (outcome.action === ImportRowAction.CREATED || outcome.action === ImportRowAction.UPDATED) matchedCount++;
        else failedCount++;

        await prisma.importRow.create({
          data: {
            importId: batchImport.id,
            rowNumber,
            rawData: dataMap,
            matchedStudentId: outcome.matchedStudentId,
            action: outcome.action,
            previousValueSnapshot: outcome.previousValueSnapshot,
            errorReason: outcome.errorReason,
          },
        });
      } catch (rowError) {
        failedCount++;
        await prisma.importRow.create({
          data: {
            importId: batchImport.id,
            rowNumber,
            rawData: dataMap,
            action: ImportRowAction.FAILED,
            errorReason: rowError instanceof Error ? rowError.message : "Kesalahan pengolahan baris.",
          },
        });
      }
    }

    await prisma.import.update({ where: { id: batchImport.id }, data: { matchedRows: matchedCount, failedRows: failedCount } });

    revalidatePath("/admin/imports");
    return { ok: true, summary: `Impor selesai: ${matchedCount} baris berhasil diproses, ${failedCount} baris gagal/tidak cocok.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal mengimpor file." };
  }
}

export async function verifyPsdmLayerAction(studentId: string, status: "VERIFIED" | "REJECTED", note: string): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.ADMIN);

    await prisma.verification.upsert({
      where: { studentId_layer: { studentId, layer: VerificationLayer.PSDM } },
      update: { status: status as VerificationStatus, note: note || null, verifiedByUserId: user.id, verifiedAt: new Date() },
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

/**
 * Shared by the finalization page's "ready" filter and the action below —
 * a student is eligible once PSDM has verified them, and Damen too if that
 * layer is currently enabled. Kept in one place so both never drift apart.
 */
export async function isStudentEligibleForFinalization(studentId: string): Promise<boolean> {
  const [damenSetting, verifications] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SETTING_KEYS.damenEnabled } }),
    prisma.verification.findMany({ where: { studentId } }),
  ]);
  const damenEnabled = !!damenSetting?.value;

  const psdmOk = verifications.some((v) => v.layer === VerificationLayer.PSDM && v.status === VerificationStatus.VERIFIED);
  if (!psdmOk) return false;
  if (!damenEnabled) return true;
  return verifications.some((v) => v.layer === VerificationLayer.DAMEN && v.status === VerificationStatus.VERIFIED);
}

export async function finalizeRaportsAction(): Promise<ActionResult> {
  try {
    const user = await assertRole(Role.ADMIN);

    const [students, damenSetting, marsThresholdSetting] = await Promise.all([
      prisma.student.findMany({ where: { active: true }, select: { id: true } }),
      prisma.setting.findUnique({ where: { key: SETTING_KEYS.damenEnabled } }),
      prisma.setting.findUnique({ where: { key: SETTING_KEYS.marsPassThreshold } }),
    ]);
    const damenEnabled = !!damenSetting?.value;
    const marsThreshold = typeof marsThresholdSetting?.value === "number" ? marsThresholdSetting.value : 70;

    const studentIds = students.map((s) => s.id);
    const verifications = await prisma.verification.findMany({ where: { studentId: { in: studentIds } } });
    const verificationsByStudent = new Map<string, typeof verifications>();
    for (const v of verifications) {
      const list = verificationsByStudent.get(v.studentId) ?? [];
      list.push(v);
      verificationsByStudent.set(v.studentId, list);
    }

    // Mars Electics score, fetched in bulk (one query, not one per student) via
    // its known material code — used for the pass/fail recommendation heuristic.
    const marsParam = await prisma.parameter.findFirst({ where: { material: { code: "MARS_ELECTICS" } } });
    const marsScores = marsParam
      ? await prisma.score.findMany({ where: { parameterId: marsParam.id, studentId: { in: studentIds } }, select: { studentId: true, value: true } })
      : [];
    const marsByStudent = new Map(marsScores.map((s) => [s.studentId, s.value]));

    let finalizedCount = 0;
    let skippedCount = 0;

    for (const student of students) {
      const studentVerifications = verificationsByStudent.get(student.id) ?? [];
      const psdmOk = studentVerifications.some((v) => v.layer === VerificationLayer.PSDM && v.status === VerificationStatus.VERIFIED);
      const damenOk = !damenEnabled || studentVerifications.some((v) => v.layer === VerificationLayer.DAMEN && v.status === VerificationStatus.VERIFIED);
      if (!psdmOk || !damenOk) {
        skippedCount++;
        continue;
      }

      const computed = await computeScores(student.id);
      const personalScore = computed.personal.score ?? 0;
      const skillScore = computed.skill.score ?? 0;

      const attendanceItem = computed.personal.items.find((item) => item.refCode === "ATTENDANCE");
      const isAttendanceFailed = attendanceItem !== undefined && attendanceItem.normalizedValue < 70;

      const marsValue = marsByStudent.get(student.id);
      const isMarsFailed = marsValue !== null && marsValue !== undefined && marsValue < marsThreshold;

      let recommendation = "LULUS";
      if (isAttendanceFailed || isMarsFailed) {
        recommendation = "TIDAK LULUS (kriteria minimum kehadiran atau Mars Electics belum terpenuhi)";
      } else if (personalScore < 60 || skillScore < 60) {
        recommendation = "LULUS DENGAN EVALUASI";
      }

      await prisma.raportSnapshot.upsert({
        where: { studentId: student.id },
        update: { personalScore, skillScore, breakdown: computed, recommendation, finalizedByUserId: user.id, finalizedAt: new Date() },
        create: { studentId: student.id, personalScore, skillScore, breakdown: computed, recommendation, finalizedByUserId: user.id },
      });
      finalizedCount++;
    }

    revalidatePath("/admin/finalization");
    return {
      ok: true,
      summary: `Finalisasi selesai: ${finalizedCount} maba dibekukan, ${skippedCount} maba dilewati (belum lolos verifikasi PSDM${damenEnabled ? "/Damen" : ""}).`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal melakukan finalisasi raport." };
  }
}
