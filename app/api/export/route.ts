import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role, AttendanceStatus } from "@/app/generated/prisma/enums";

export async function GET(request: Request) {
  try {
    // Assert the caller is Admin / PSDM
    const user = await assertRole(Role.ADMIN);

    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get("type") || "main";

    // 1. Fetch all data needed for excel calculation
    const [students, parameters, activities, departments] = await Promise.all([
      prisma.student.findMany({
        where: { active: true },
        include: {
          unit: { include: { region: true } },
          department: true,
          personalityProfile: true,
          questionnaireStatuses: true,
          attendances: { include: { session: true } },
          scores: {
            include: {
              parameter: { include: { material: { include: { activity: true } } } },
              session: true,
            },
          },
        },
      }),
      prisma.parameter.findMany({
        where: { active: true },
        include: { material: { include: { activity: true } } },
        orderBy: [{ material: { activity: { order: "asc" } } }, { material: { order: "asc" } }, { order: "asc" }],
      }),
      prisma.activity.findMany({ orderBy: { order: "asc" } }),
      prisma.department.findMany({
        include: {
          students: {
            where: { active: true },
            select: { id: true },
          },
        },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Portal Pengembangan MABA 26";
    workbook.created = new Date();

    if (exportType === "main") {
      // ==========================================
      // SHEET 1: LONG MENTAH
      // ==========================================
      const sheet1 = workbook.addWorksheet("Long Mentah");
      sheet1.columns = [
        { header: "NRP", key: "nrp", width: 15 },
        { header: "Nama", key: "name", width: 25 },
        { header: "Region", key: "region", width: 12 },
        { header: "Unit", key: "unit", width: 12 },
        { header: "Departemen", key: "department", width: 20 },
        { header: "MBTI", key: "mbti", width: 10 },
        { header: "Temperament", key: "temperament", width: 15 },
        { header: "Kegiatan", key: "activity", width: 20 },
        { header: "Sesi", key: "session", width: 15 },
        { header: "Materi", key: "material", width: 20 },
        { header: "Sub-Kode", key: "subCode", width: 10 },
        { header: "Nama Parameter", key: "parameter", width: 25 },
        { header: "Nilai Mentah", key: "rawValue", width: 12 },
        { header: "Nilai Maks", key: "maxValue", width: 12 },
        { header: "Sumber Data", key: "source", width: 12 },
      ];

      students.forEach((student) => {
        const rowBase = {
          nrp: student.nrp,
          name: student.name,
          region: student.unit.region.name,
          unit: student.unit.name,
          department: student.department?.name || "-",
          mbti: student.personalityProfile?.mbtiType || "-",
          temperament: student.personalityProfile?.temperament || "-",
        };

        // Write scores
        student.scores.forEach((score) => {
          sheet1.addRow({
            ...rowBase,
            activity: score.parameter.material.activity.name,
            session: score.session.name,
            material: score.parameter.material.name,
            subCode: score.parameter.subCode,
            parameter: score.parameter.name,
            rawValue: score.value !== null ? score.value : "",
            maxValue: score.parameter.maxValue,
            source: score.source,
          });
        });

        // Write attendances
        student.attendances.forEach((att) => {
          sheet1.addRow({
            ...rowBase,
            activity: att.session.code === "UMUM" ? "Umum" : "Kehadiran Sesi",
            session: att.session.name,
            material: "Attendance & Participation",
            subCode: "ATT",
            parameter: `Kehadiran Sesi (${att.session.name})`,
            rawValue: att.status === AttendanceStatus.HADIR ? att.participationScore || 4 : att.status === AttendanceStatus.IZIN ? 2 : 0,
            maxValue: 4,
            source: att.source,
          });
        });
      });

      // ==========================================
      // SHEET 2: WIDE PER KEGIATAN (SPSS COMPLIANT)
      // ==========================================
      const sheet2 = workbook.addWorksheet("Wide per Kegiatan");
      
      // Dynamic Headers for Wide view
      // SPSS variable names must start with letter, no spaces, only alphanumeric and underscores
      const spssHeaders = parameters.map(p => ({
        id: p.id,
        header: `${p.material.code}_${p.subCode}`, // e.g. KWYA_B1, WAWASAN_TEKNOLOGI_C1
        width: 15
      }));

      sheet2.columns = [
        { header: "NRP", key: "nrp", width: 15 },
        { header: "Nama", key: "name", width: 25 },
        { header: "Region", key: "region", width: 12 },
        { header: "Unit", key: "unit", width: 12 },
        { header: "Departemen", key: "department", width: 20 },
        ...spssHeaders
      ];

      students.forEach((student) => {
        const rowData: any = {
          nrp: student.nrp,
          name: student.name,
          region: student.unit.region.name,
          unit: student.unit.name,
          department: student.department?.name || "-",
        };

        // Populate scores mapping parameter ID
        parameters.forEach(p => {
          const score = student.scores.find(s => s.parameterId === p.id);
          rowData[`${p.material.code}_${p.subCode}`] = score && score.value !== null ? score.value : "";
        });

        sheet2.addRow(rowData);
      });

      // ==========================================
      // SHEET 3: PRE-POST SPSS
      // ==========================================
      const sheet3 = workbook.addWorksheet("Pre-Post SPSS");
      sheet3.columns = [
        { header: "NRP", key: "nrp", width: 15 },
        { header: "Nama", key: "name", width: 25 },
        { header: "K1_Baseline_Submitted", key: "k1", width: 25 },
        { header: "K2_Reflection_Submitted", key: "k2", width: 25 },
        { header: "Temu1_JAD_Avg", key: "t1_jad", width: 18 },
        { header: "Temu3_JAD_Avg", key: "t3_jad", width: 18 },
        { header: "Delta_JAD_Avg", key: "delta_jad", width: 18 },
      ];

      students.forEach((student) => {
        const k1 = student.questionnaireStatuses.find(q => q.code === "K1")?.submitted ? 1 : 0;
        const k2 = student.questionnaireStatuses.find(q => q.code === "K2")?.submitted ? 1 : 0;

        // Fetch scores under JAD for Temu 1 vs Temu 3
        const t1Scores = student.scores.filter(
          s => s.parameter.material.activity.code === "TEMU_1" && s.parameter.material.code === "JAD" && s.value !== null
        );
        const t3Scores = student.scores.filter(
          s => s.parameter.material.activity.code === "TEMU_3" && s.parameter.material.code === "JAD" && s.value !== null
        );

        const t1Avg = t1Scores.length > 0 
          ? Number((t1Scores.reduce((a, b) => a + (b.value || 0), 0) / t1Scores.length).toFixed(2)) 
          : "";
        const t3Avg = t3Scores.length > 0 
          ? Number((t3Scores.reduce((a, b) => a + (b.value || 0), 0) / t3Scores.length).toFixed(2)) 
          : "";

        const delta = (t1Avg !== "" && t3Avg !== "") 
          ? Number((Number(t3Avg) - Number(t1Avg)).toFixed(2)) 
          : "";

        sheet3.addRow({
          nrp: student.nrp,
          name: student.name,
          k1,
          k2,
          t1_jad: t1Avg,
          t3_jad: t3Avg,
          delta_jad: delta,
        });
      });

      // ==========================================
      // SHEET 4: PERSEBARAN HMD (DB7)
      // ==========================================
      const sheet4 = workbook.addWorksheet("Persebaran HMD");
      sheet4.columns = [
        { header: "ID Departemen", key: "id", width: 25 },
        { header: "Kode", key: "code", width: 15 },
        { header: "Nama Departemen", key: "name", width: 35 },
        { header: "Total Maba Aktif", key: "mabaCount", width: 18 },
      ];

      departments.forEach((dept) => {
        sheet4.addRow({
          id: dept.id,
          code: dept.code,
          name: dept.name,
          mabaCount: dept.students.length,
        });
      });
    }

    // Write to a buffer and return
    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=portal_gradaks_export_${new Date().toISOString().split("T")[0]}.xlsx`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Gagal mengekspor data." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
