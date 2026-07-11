/**
 * Seed data is STRUCTURAL placeholder data, not real GRADAKS 2026 org
 * data: region/unit/department names, student rosters, and rubric anchor
 * text are all clearly-labeled placeholders (per the brief's own
 * acknowledgment that rubric text isn't PSDM-authorized yet). Everything
 * here is editable later from /admin/master-data or via CSV import — that
 * editability is the point, not an oversight.
 *
 * Scores/attendance/logbook are seeded as a PARTIAL demo dataset (not
 * 100% complete) specifically so the completeness dashboards have
 * something real to show. Since today (per project context) is before
 * Inclenation even starts, none of this has "really" happened yet in the
 * brief's own timeline — this is demo data to exercise the system, not a
 * claim about real-world state.
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { Role, ParameterType, InputMethod, SessionMode, AttendanceStatus, LogbookStatus, ScoreSource, QuestionnaireCode } from "../app/generated/prisma/enums";
import { SETTING_KEYS } from "../lib/scoring/setting-keys";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const REGION_COUNT = 14;
const UNITS_PER_REGION = 10;
const STUDENTS_PER_UNIT_MIN = 6;
const STUDENTS_PER_UNIT_MAX = 9;
const DEMO_PASSWORD = "gradaks2026";
const SHOWCASE_UNIT_COUNT = 8; // units that get a fuller demo dataset (scores/groups/logbook)

const FIRST_NAMES = [
  "Ahmad", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Indra", "Joko",
  "Kartika", "Lestari", "Muhammad", "Nadia", "Oki", "Putri", "Qori", "Rizky", "Siti", "Taufik",
  "Umar", "Vina", "Wahyu", "Yusuf", "Zahra", "Agus", "Bella", "Cahyo", "Dian", "Erlangga",
];
const LAST_NAMES = [
  "Pratama", "Saputra", "Wijaya", "Kusuma", "Santoso", "Wibowo", "Hidayat", "Setiawan", "Permata", "Nugroho",
  "Rahayu", "Suryani", "Gunawan", "Handoko", "Susanto", "Anggraini", "Firmansyah", "Maulana", "Ramadhan", "Utami",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Weighted-ish random 1-4 so demo data doesn't look perfectly flat. */
function randomRubricValue() {
  const roll = Math.random();
  if (roll < 0.08) return 1;
  if (roll < 0.3) return 2;
  if (roll < 0.75) return 3;
  return 4;
}

function placeholderAnchors(paramLabel: string) {
  return {
    "1": `TODO-PSDM: deskripsi perilaku skor 1 untuk "${paramLabel}" (belum disahkan PSDM)`,
    "2": `TODO-PSDM: deskripsi perilaku skor 2 untuk "${paramLabel}"`,
    "3": `TODO-PSDM: deskripsi perilaku skor 3 untuk "${paramLabel}"`,
    "4": `TODO-PSDM: deskripsi perilaku skor 4 untuk "${paramLabel}"`,
  };
}

async function seedSettings() {
  const defaults: Array<{ key: string; value: number | boolean }> = [
    { key: SETTING_KEYS.attendancePersonal, value: 0.1 },
    { key: SETTING_KEYS.attendanceSkill, value: 0.1 },
    { key: SETTING_KEYS.logbookPersonal, value: 0.15 },
    { key: SETTING_KEYS.logbookSkill, value: 0.1 },
    { key: SETTING_KEYS.k1Skill, value: 0.05 },
    { key: SETTING_KEYS.k2Skill, value: 0.1 },
    { key: SETTING_KEYS.calibrationThreshold, value: 0.6 },
    { key: SETTING_KEYS.damenEnabled, value: false },
    { key: SETTING_KEYS.marsPassThreshold, value: 70 },
  ];
  for (const setting of defaults) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: { key: setting.key, value: setting.value },
    });
  }
  console.log(`Settings: ${defaults.length} keys`);
}

async function seedDepartments() {
  const departments = Array.from({ length: 5 }, (_, i) => ({
    id: randomUUID(),
    code: `DEP${i + 1}`,
    name: `Departemen ${i + 1} (placeholder — ganti dengan nama HMD asli)`,
  }));
  await prisma.department.createMany({ data: departments, skipDuplicates: true });
  console.log(`Departments: ${departments.length}`);
  return departments;
}

async function seedRegionsAndUnits() {
  const regions = Array.from({ length: REGION_COUNT }, (_, i) => ({
    id: randomUUID(),
    code: `R${String(i + 1).padStart(2, "0")}`,
    name: `Region ${i + 1} (placeholder)`,
  }));
  await prisma.region.createMany({ data: regions, skipDuplicates: true });

  const units = regions.flatMap((region, ri) =>
    Array.from({ length: UNITS_PER_REGION }, (_, ui) => ({
      id: randomUUID(),
      code: `${region.code}-U${String(ui + 1).padStart(2, "0")}`,
      name: `Unit ${ui + 1}`,
      regionId: region.id,
      regionIndex: ri,
      unitIndex: ui,
    })),
  );
  await prisma.unit.createMany({
    data: units.map(({ id, code, name, regionId }) => ({ id, code, name, regionId })),
    skipDuplicates: true,
  });
  console.log(`Regions: ${regions.length}, Units: ${units.length}`);
  return { regions, units };
}

async function seedStudents(units: { id: string }[], departments: { id: string }[]) {
  const students = units.flatMap((unit) => {
    const count = randomInt(STUDENTS_PER_UNIT_MIN, STUDENTS_PER_UNIT_MAX);
    return Array.from({ length: count }, () => ({
      id: randomUUID(),
      nrp: `25${randomInt(10000000, 99999999)}`,
      name: randomName(),
      unitId: unit.id,
      departmentId: pick(departments).id,
    }));
  });
  // NRPs are randomly generated above; enforce uniqueness defensively.
  const seen = new Set<string>();
  for (const s of students) {
    while (seen.has(s.nrp)) s.nrp = `25${randomInt(10000000, 99999999)}`;
    seen.add(s.nrp);
  }
  await prisma.student.createMany({ data: students, skipDuplicates: true });
  console.log(`Students: ${students.length}`);
  return students;
}

async function seedUsers(regions: { id: string; code: string }[], units: { id: string; code: string; regionId: string }[]) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admins = [
    { id: randomUUID(), nrp: "admin", name: "Admin PSDM Utama", role: Role.ADMIN, passwordHash, regionId: null, unitId: null },
  ];

  const damens = [
    {
      id: randomUUID(),
      nrp: "damen1",
      name: "Damen Demo",
      role: Role.DAMEN,
      passwordHash,
      regionId: null,
      unitId: null,
    },
  ];

  const krs = regions.map((region) => ({
    id: randomUUID(),
    nrp: `kr.${region.code.toLowerCase()}`,
    name: `Kepala ${region.code} (placeholder)`,
    role: Role.KEPALA_REGION,
    passwordHash,
    regionId: region.id,
    unitId: null,
  }));

  const mentors = units.map((unit) => ({
    id: randomUUID(),
    nrp: `mentor.${unit.code.toLowerCase()}`,
    name: `Mentor ${unit.code}`,
    role: Role.MENTOR,
    passwordHash,
    regionId: null,
    unitId: unit.id,
  }));

  await prisma.user.createMany({ data: [...admins, ...damens, ...krs, ...mentors], skipDuplicates: true });
  console.log(`Users: ${admins.length + damens.length + krs.length + mentors.length} (admin/damen/KR/mentor)`);
  return { admins, krs, mentors };
}

type SeededActivity = { id: string; code: string; order: number };
type SeededSession = { id: string; code: string; activityId: string };
type SeededParameter = {
  id: string;
  materialId: string;
  subCode: string;
  name: string;
  type: ParameterType;
  personalWeight: number | null;
  skillWeight: number | null;
  maxValue: number;
  inputMethod: InputMethod;
};

async function seedActivity(code: string, name: string, order: number, isImportOnly = false): Promise<SeededActivity> {
  const activity = await prisma.activity.upsert({
    where: { code },
    update: { name, order, isImportOnly },
    create: { id: randomUUID(), code, name, order, isImportOnly },
  });
  return activity;
}

async function seedSession(activityId: string, code: string, name: string, mode: SessionMode, quorumThresholdPct?: number) {
  return prisma.activitySession.upsert({
    where: { activityId_code: { activityId, code } },
    update: { name, mode },
    create: {
      id: randomUUID(),
      activityId,
      code,
      name,
      mode,
      quorumThresholdPct: quorumThresholdPct ?? null,
    },
  });
}

async function seedMaterialWithParams(
  activityId: string,
  materialCode: string,
  materialName: string,
  materialOrder: number,
  params: Array<{
    subCode: string;
    name: string;
    type: ParameterType;
    personalWeight: number | null;
    skillWeight: number | null;
    maxValue: number;
    inputMethod: InputMethod;
    order: number;
  }>,
): Promise<SeededParameter[]> {
  const material = await prisma.material.upsert({
    where: { activityId_code: { activityId, code: materialCode } },
    update: { name: materialName, order: materialOrder },
    create: { id: randomUUID(), activityId, code: materialCode, name: materialName, order: materialOrder },
  });

  const created: SeededParameter[] = [];
  for (const p of params) {
    const rubricAnchors = p.type === ParameterType.B ? placeholderAnchors(p.name) : undefined;
    const param = await prisma.parameter.upsert({
      where: { materialId_subCode: { materialId: material.id, subCode: p.subCode } },
      update: {
        name: p.name,
        type: p.type,
        personalWeight: p.personalWeight,
        skillWeight: p.skillWeight,
        maxValue: p.maxValue,
        inputMethod: p.inputMethod,
        order: p.order,
        ...(rubricAnchors ? { rubricAnchors } : {}),
      },
      create: {
        id: randomUUID(),
        materialId: material.id,
        subCode: p.subCode,
        name: p.name,
        type: p.type,
        personalWeight: p.personalWeight,
        skillWeight: p.skillWeight,
        maxValue: p.maxValue,
        inputMethod: p.inputMethod,
        order: p.order,
        rubricAnchors,
      },
    });
    created.push({ ...param, personalWeight: p.personalWeight, skillWeight: p.skillWeight });
  }
  return created;
}

/** KWYA(8)/BMB(4)/JAD(4)/HTWF(7)/WUWE(3) item counts are taken directly
 * from the brief; item names and weights below are placeholders in the
 * same spirit as the rubric anchors — real names/weights come from the
 * (unavailable to us) SCORING_MENTOR_2026 workbook. */
function behaviorParams(
  prefix: string,
  count: number,
  bucket: "personal" | "skill",
  totalWeightBudget: number,
): Array<{ subCode: string; name: string; type: ParameterType; personalWeight: number | null; skillWeight: number | null; maxValue: number; inputMethod: InputMethod; order: number }> {
  const perItem = Number((totalWeightBudget / count).toFixed(4));
  return Array.from({ length: count }, (_, i) => ({
    subCode: `B${i + 1}`,
    name: `${prefix} — Butir ${i + 1}`,
    type: ParameterType.B,
    personalWeight: bucket === "personal" ? perItem : null,
    skillWeight: bucket === "skill" ? perItem : null,
    maxValue: 4,
    inputMethod: InputMethod.MENTOR,
    order: i + 1,
  }));
}

async function seedProgramStructure() {
  const inclenation = await seedActivity("INCLENATION", "Inclenation", 1);
  const temu0 = await seedActivity("TEMU_0", "Temu FTEIC 0 (Baseline)", 2);
  const temu1 = await seedActivity("TEMU_1", "Temu FTEIC 1", 3);
  const temu2 = await seedActivity("TEMU_2", "Temu FTEIC 2", 4);
  const temu3 = await seedActivity("TEMU_3", "Temu FTEIC 3", 5);
  const temu31 = await seedActivity("TEMU_3_1", "Temu FTEIC 3.1 (Refleksi)", 6);
  const proker = await seedActivity("PROKER", "Proker Fakultas", 7, true);

  // Every activity gets a synthetic "UMUM" session as the binding target
  // for parameters that aren't tied to one specific meeting (e.g. an
  // overall behavior rating for the whole activity) — keeps the
  // (studentId, parameterId, sessionId) unique constraint airtight
  // without needing a nullable sessionId. Real meetings are seeded
  // alongside it for attendance/confirmation.
  const inclUmum = await seedSession(inclenation.id, "UMUM", "Umum (nilai keseluruhan Inclenation)", SessionMode.NA);
  await seedSession(inclenation.id, "H1", "Inclenation — Hari 1", SessionMode.OFFLINE);
  await seedSession(inclenation.id, "H2", "Inclenation — Hari 2", SessionMode.OFFLINE);

  await seedSession(temu0.id, "UMUM", "Umum", SessionMode.NA);
  await seedSession(temu0.id, "0.0", "Temu FTEIC 0", SessionMode.OFFLINE);

  const temuSessions: Record<string, { umum: SeededSession }> = {};
  for (const [key, activity] of [
    ["TEMU_1", temu1],
    ["TEMU_2", temu2],
    ["TEMU_3", temu3],
  ] as const) {
    const umum = await seedSession(activity.id, "UMUM", "Umum", SessionMode.NA);
    await seedSession(activity.id, `${activity.order - 2}.0`, `Sesi ${activity.order - 2}.0 (Offline)`, SessionMode.OFFLINE, 75);
    await seedSession(activity.id, `${activity.order - 2}.1`, `Sesi ${activity.order - 2}.1 (Online)`, SessionMode.ONLINE, 75);
    temuSessions[key] = { umum };
  }

  await seedSession(temu31.id, "UMUM", "Umum", SessionMode.NA);
  await seedSession(temu31.id, "3.1", "Temu FTEIC 3.1", SessionMode.OFFLINE);

  for (const name of ["Pesraf", "Arus Emas", "Soscom", "Diesnat"]) {
    await seedSession(proker.id, name.toUpperCase().replace(/\s+/g, "_"), name, SessionMode.OFFLINE);
  }

  // --- Inclenation materials ---
  const kwya = await seedMaterialWithParams(
    inclenation.id,
    "KWYA",
    "KWYA",
    1,
    behaviorParams("KWYA", 8, "personal", 0.2),
  );
  const bmb = await seedMaterialWithParams(
    inclenation.id,
    "BMB",
    "BMB",
    2,
    behaviorParams("BMB", 4, "personal", 0.2),
  );
  const wawasanTeknologi = await seedMaterialWithParams(inclenation.id, "WAWASAN_TEKNOLOGI", "Wawasan Teknologi (Penugasan Kelompok)", 3, [
    { subCode: "C1", name: "Kelengkapan Infografis", type: ParameterType.C, personalWeight: null, skillWeight: 0.059, maxValue: 4, inputMethod: InputMethod.GROUP, order: 1 },
    { subCode: "C2", name: "Akurasi Konten", type: ParameterType.C, personalWeight: null, skillWeight: 0.05, maxValue: 4, inputMethod: InputMethod.GROUP, order: 2 },
    { subCode: "C3", name: "Kualitas Presentasi", type: ParameterType.C, personalWeight: null, skillWeight: 0.045, maxValue: 4, inputMethod: InputMethod.GROUP, order: 3 },
    { subCode: "C4", name: "Kerja Sama Tim", type: ParameterType.C, personalWeight: null, skillWeight: 0.04, maxValue: 4, inputMethod: InputMethod.GROUP, order: 4 },
    { subCode: "C5", name: "Ketepatan Waktu", type: ParameterType.C, personalWeight: null, skillWeight: 0.03, maxValue: 4, inputMethod: InputMethod.GROUP, order: 5 },
  ]);
  const wawasanFteic = await seedMaterialWithParams(inclenation.id, "WAWASAN_FTEIC", "Wawasan FTEIC (Post-test)", 4, [
    { subCode: "D1", name: "Topik 1 — Sejarah & Struktur FTEIC", type: ParameterType.D, personalWeight: null, skillWeight: 0.05, maxValue: 100, inputMethod: InputMethod.IMPORT, order: 1 },
    { subCode: "D2", name: "Topik 2 — Nilai & Budaya", type: ParameterType.D, personalWeight: null, skillWeight: 0.05, maxValue: 100, inputMethod: InputMethod.IMPORT, order: 2 },
    { subCode: "D3", name: "Topik 3 — Organisasi Kemahasiswaan", type: ParameterType.D, personalWeight: null, skillWeight: 0.05, maxValue: 100, inputMethod: InputMethod.IMPORT, order: 3 },
  ]);
  const marsElectics = await seedMaterialWithParams(inclenation.id, "MARS_ELECTICS", "Mars Electics", 5, [
    { subCode: "D1", name: "Hafalan & Penghayatan Mars Electics", type: ParameterType.D, personalWeight: 0.05, skillWeight: 0.05, maxValue: 100, inputMethod: InputMethod.MENTOR, order: 1 },
  ]);

  // --- Temu FTEIC 1-3: JAD/HTWF/WUWE recur once per cycle ---
  const temuMaterialParams: Record<string, { jad: SeededParameter[]; htwf: SeededParameter[]; wuwe: SeededParameter[] }> = {};
  for (const [key, activity] of [
    ["TEMU_1", temu1],
    ["TEMU_2", temu2],
    ["TEMU_3", temu3],
  ] as const) {
    const jad = await seedMaterialWithParams(activity.id, "JAD", "JAD", 1, behaviorParams("JAD", 4, "skill", 0.16));
    const htwf = await seedMaterialWithParams(activity.id, "HTWF", "HTWF", 2, behaviorParams("HTWF", 7, "skill", 0.2));
    const wuwe = await seedMaterialWithParams(activity.id, "WUWE", "WUWE", 3, behaviorParams("WUWE", 3, "skill", 0.15));
    temuMaterialParams[key] = { jad, htwf, wuwe };
  }

  console.log("Program structure: 7 activities, sessions, materials, parameters seeded.");

  return {
    inclenation,
    temu0,
    temu1,
    temu2,
    temu3,
    temu31,
    proker,
    inclUmum,
    inclenationParams: { kwya, bmb, wawasanTeknologi, wawasanFteic, marsElectics },
    temuMaterialParams,
  };
}

async function seedDemoDataForShowcaseUnits(
  units: Array<{ id: string; code: string; regionId: string }>,
  allStudentsByUnit: Map<string, Array<{ id: string; nrp: string }>>,
  program: Awaited<ReturnType<typeof seedProgramStructure>>,
  mentorsByUnitId: Map<string, string>,
) {
  const showcaseUnits = units.slice(0, SHOWCASE_UNIT_COUNT);
  const inclUmumSession = program.inclUmum;

  let scoreCount = 0;
  let attendanceCount = 0;
  let logbookCount = 0;
  let questionnaireCount = 0;
  let personalityCount = 0;
  let groupCount = 0;

  for (const unit of showcaseUnits) {
    const students = allStudentsByUnit.get(unit.id) ?? [];
    const mentorUserId = mentorsByUnitId.get(unit.id);
    const inclSessions = await prisma.activitySession.findMany({
      where: { activityId: program.inclenation.id, code: { in: ["H1", "H2"] } },
    });

    // Personality profiles + K1/K2 questionnaire status for every student in showcase units.
    for (const student of students) {
      if (Math.random() < 0.85) {
        await prisma.personalityProfile.create({
          data: {
            id: randomUUID(),
            studentId: student.id,
            mbtiType: pick(["INTJ", "ENFP", "ISTJ", "ESFJ", "INFP", "ENTP", "ISFP", "ESTJ"] as const),
            temperament: pick(["Sanguinis", "Koleris", "Melankolis", "Plegmatis"] as const),
            importedAt: new Date(),
          },
        });
        personalityCount++;
      }
      for (const code of [QuestionnaireCode.K1, QuestionnaireCode.K2] as const) {
        const submitted = code === QuestionnaireCode.K1 ? Math.random() < 0.9 : Math.random() < 0.4;
        await prisma.questionnaireStatus.create({
          data: {
            id: randomUUID(),
            studentId: student.id,
            code,
            submitted,
            submittedAt: submitted ? new Date() : null,
          },
        });
        questionnaireCount++;
      }

      // Logbook: 2-4 entries per student, mostly verified.
      const entryCount = randomInt(2, 4);
      for (let i = 0; i < entryCount; i++) {
        const verified = Math.random() < 0.7;
        await prisma.logbookEntry.create({
          data: {
            id: randomUUID(),
            studentId: student.id,
            periodLabel: `Minggu ${i + 1}`,
            content: `Ringkasan kegiatan minggu ${i + 1} (data demo, diimpor dari GForm).`,
            status: verified ? LogbookStatus.LENGKAP : LogbookStatus.BELUM_DIVERIFIKASI,
            verifiedByUserId: verified ? mentorUserId : null,
            verifiedAt: verified ? new Date() : null,
          },
        });
        logbookCount++;
      }
    }

    // Behavior + post-test scores at Inclenation for ~70% of students (partial completeness).
    const inclenationParams = [
      ...program.inclenationParams.kwya,
      ...program.inclenationParams.bmb,
      ...program.inclenationParams.wawasanFteic,
      ...program.inclenationParams.marsElectics,
    ];
    for (const student of students) {
      if (Math.random() > 0.7) continue;
      for (const param of inclenationParams) {
        const value = param.maxValue === 100 ? randomInt(55, 98) : randomRubricValue();
        await prisma.score.create({
          data: {
            id: randomUUID(),
            studentId: student.id,
            parameterId: param.id,
            sessionId: inclUmumSession.id,
            value,
            enteredByUserId: mentorUserId,
            source: param.inputMethod === InputMethod.IMPORT ? ScoreSource.IMPORT : ScoreSource.MENTOR,
          },
        });
        scoreCount++;
      }

      // Attendance for Inclenation's two real sessions.
      for (const session of inclSessions) {
        if (Math.random() > 0.85) continue;
        const status = Math.random() < 0.85 ? AttendanceStatus.HADIR : Math.random() < 0.7 ? AttendanceStatus.IZIN : AttendanceStatus.ALPA;
        await prisma.attendance.create({
          data: {
            id: randomUUID(),
            studentId: student.id,
            sessionId: session.id,
            status,
            participationScore: status === AttendanceStatus.HADIR ? randomRubricValue() : null,
            mode: SessionMode.OFFLINE,
            enteredByUserId: mentorUserId,
            source: ScoreSource.MENTOR,
          },
        });
        attendanceCount++;
      }
    }

    // One demo group for Wawasan Teknologi per showcase unit.
    if (students.length >= 2) {
      const group = await prisma.group.create({
        data: {
          id: randomUUID(),
          materialId: program.inclenationParams.wawasanTeknologi[0].materialId,
          unitId: unit.id,
          name: "Kelompok 1",
        },
      });
      groupCount++;
      const members = students.slice(0, Math.min(3, students.length));
      await prisma.groupMember.createMany({
        data: members.map((s) => ({ id: randomUUID(), groupId: group.id, studentId: s.id })),
      });
      for (const param of program.inclenationParams.wawasanTeknologi) {
        await prisma.groupScore.create({
          data: {
            id: randomUUID(),
            groupId: group.id,
            parameterId: param.id,
            value: randomRubricValue(),
            enteredByUserId: mentorUserId,
          },
        });
      }
    }
  }

  console.log(
    `Demo data (showcase units: ${showcaseUnits.length}): scores=${scoreCount} attendance=${attendanceCount} logbook=${logbookCount} questionnaire=${questionnaireCount} personality=${personalityCount} groups=${groupCount}`,
  );
}

async function main() {
  console.log("Seeding Portal Pengembangan MABA 26...\n");

  await seedSettings();
  const departments = await seedDepartments();
  const { regions, units } = await seedRegionsAndUnits();
  const students = await seedStudents(units, departments);
  await seedUsers(regions, units);
  const program = await seedProgramStructure();

  const allStudentsByUnit = new Map<string, Array<{ id: string; nrp: string }>>();
  for (const s of students) {
    const list = allStudentsByUnit.get(s.unitId) ?? [];
    list.push({ id: s.id, nrp: s.nrp });
    allStudentsByUnit.set(s.unitId, list);
  }

  const mentorUsers = await prisma.user.findMany({ where: { role: Role.MENTOR }, select: { id: true, unitId: true } });
  const mentorsByUnitId = new Map(mentorUsers.filter((m) => m.unitId).map((m) => [m.unitId as string, m.id]));

  await seedDemoDataForShowcaseUnits(units, allStudentsByUnit, program, mentorsByUnitId);

  console.log("\nSeed complete.");
  console.log(`Login demo: admin / ${DEMO_PASSWORD}, kr.r01 / ${DEMO_PASSWORD}, mentor.r01-u01 / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
