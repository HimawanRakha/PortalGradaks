/**
 * Seed data is STRUCTURAL data and initial demo data for Portal Pengembangan MABA 26.
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../app/generated/prisma/client";
import { Role, ParameterType, InputMethod, SessionMode, AttendanceStatus, LogbookStatus, ScoreSource, QuestionnaireCode } from "../app/generated/prisma/enums";
import { SETTING_KEYS } from "../lib/scoring/setting-keys";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const STUDENTS_PER_UNIT_MIN = 6;
const STUDENTS_PER_UNIT_MAX = 9;
const DEMO_PASSWORD = "gradaks2026";
const SHOWCASE_UNIT_COUNT = 8;

const FIRST_NAMES = [
  "Ahmad", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hana", "Indra", "Joko",
  "Kartika", "Lestari", "Muhammad", "Nadia", "Oki", "Putri", "Qori", "Rizky", "Siti", "Taufik",
  "Umar", "Vina", "Wahyu", "Yusuf", "Zahra", "Agus", "Bella", "Cahyo", "Dian", "Erlangga",
];
const LAST_NAMES = [
  "Pratama", "Saputra", "Wijaya", "Kusuma", "Santoso", "Wibowo", "Hidayat", "Setiawan", "Permata", "Nugroho",
  "Rahayu", "Suryani", "Gunawan", "Handoko", "Susanto", "Anggraini", "Firmansyah", "Maulana", "Ramadhan", "Utami",
];

/** Real region/unit names — each "empire" is a Region, each city within it is a mentoring Unit. */
const EMPIRES: Array<{ name: string; units: string[] }> = [
  { name: "Kekaisaran Mughal (1526–1857)", units: ["Agra", "Delhi", "Lahore", "Dhaka", "Kabul", "Surat", "Patna", "Hyderabad", "Kolkata", "Mumbai"] },
  { name: "Dinasti Ming (1368–1644)", units: ["Beijing", "Nanjing", "Hangzhou", "Guangzhou", "Suzhou", "Chengdu", "Chang'an", "Luoyang", "Wuhan", "Fuzhou"] },
  { name: "Kekaisaran Jerman (1871–1918)", units: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Leipzig", "Dresden", "Hanover", "Nuremberg"] },
  { name: "Kekaisaran Brasil (1822–1889)", units: ["Rio de Janeiro", "Sao Paulo", "Salvador", "Recife", "Fortaleza", "Manaus", "Curitiba", "Belem", "Desterro", "Vitoria"] },
  { name: "Kerajaan Portugal (1139–1910)", units: ["Lisbon", "Porto", "Coimbra", "Braga", "Faro", "Sintra", "Evora", "Aveiro", "Guimaraes", "Setubal"] },
  { name: "Kekaisaran Romawi (27 BC–476 AD)", units: ["Roma", "Konstantinopel", "Aleksandria", "Athena", "Londinium", "Kartago", "Ravenna", "Lutetia", "Efesus", "Lugdunum"] },
  { name: "Kekaisaran Utsmaniyah (1299–1922)", units: ["Istanbul", "Bursa", "Edirne", "Kairo", "Damaskus", "Baghdad", "Beograd", "Sofia", "Sarajevo", "Konya"] },
  { name: "Kekaisaran Persia (550–330 BC)", units: ["Persepolis", "Susa", "Isfahan", "Ekbatana", "Babilonia", "Sardis", "Tirus", "Memphis", "Arbela", "Balkh"] },
  { name: "Kekaisaran Mongol (1206–1368)", units: ["Karakorum", "Shangdu", "Samarkand", "Bukhara", "Kashgar", "Otrar", "Sarai Batu", "Tabriz", "Herat", "Merv"] },
  { name: "Kekaisaran Rusia (1721–1917)", units: ["Moskow", "Saint Petersburg", "Kazan", "Ryazan", "Sochi", "Kiev", "Odessa", "Sevastopol", "Tula", "Perm"] },
  { name: "Imperium Spanyol (1492–1898)", units: ["Madrid", "Sevilla", "Barcelona", "Toledo", "Valencia", "Granada", "Cadiz", "Manila", "Havana", "Lima"] },
  { name: "Kekaisaran Prancis (19th Century)", units: ["Paris", "Lyon", "Marseille", "Amiens", "Tours", "Orleans", "Reims", "Brest", "Lille", "Nimes"] },
  { name: "Imperium Britania (16th–20th C.)", units: ["London", "Manchester", "Liverpool", "Edinburgh", "Birmingham", "Bristol", "Leeds", "Glasgow", "York", "Newcastle"] },
  { name: "Kekaisaran Jepang (1868–1947)", units: ["Tokyo", "Kyoto", "Osaka", "Hiroshima", "Nagasaki", "Yokohama", "Sapporo", "Nagoya", "Fukuoka", "Sendai"] },
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

function randomRubricValue() {
  const roll = Math.random();
  if (roll < 0.08) return 1;
  if (roll < 0.3) return 2;
  if (roll < 0.75) return 3;
  return 4;
}

function placeholderAnchors(paramLabel: string) {
  return {
    "1": `Perilaku kurang sesuai untuk "${paramLabel}"`,
    "2": `Perilaku cukup sesuai untuk "${paramLabel}"`,
    "3": `Perilaku sesuai untuk "${paramLabel}"`,
    "4": `Perilaku sangat sesuai untuk "${paramLabel}"`,
  };
}

async function seedSettings() {
  const defaults: Array<{ key: string; value: number | boolean }> = [
    { key: SETTING_KEYS.calibrationThreshold, value: 0.6 },
    { key: SETTING_KEYS.damenEnabled, value: false },
  ];
  for (const setting of defaults) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: { key: setting.key, value: setting.value },
    });
  }
}

async function seedDepartments() {
  const departments = Array.from({ length: 5 }, (_, i) => ({
    id: randomUUID(),
    code: `DEP${i + 1}`,
    name: `Departemen ${i + 1} (placeholder)`,
  }));
  await prisma.department.createMany({ data: departments, skipDuplicates: true });
  return departments;
}

async function seedRegionsAndUnits() {
  const regions = EMPIRES.map((empire, i) => ({
    id: randomUUID(),
    code: `R${String(i + 1).padStart(2, "0")}`,
    name: empire.name,
  }));
  await prisma.region.createMany({ data: regions, skipDuplicates: true });

  const units = regions.flatMap((region, ri) =>
    EMPIRES[ri].units.map((cityName, ui) => ({
      id: randomUUID(),
      code: `${region.code}-U${String(ui + 1).padStart(2, "0")}`,
      name: cityName,
      regionId: region.id,
    })),
  );
  await prisma.unit.createMany({
    data: units.map(({ id, code, name, regionId }) => ({ id, code, name, regionId })),
    skipDuplicates: true,
  });
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
  const seen = new Set<string>();
  for (const s of students) {
    while (seen.has(s.nrp)) s.nrp = `25${randomInt(10000000, 99999999)}`;
    seen.add(s.nrp);
  }
  await prisma.student.createMany({ data: students, skipDuplicates: true });
  return students;
}

async function seedUsers(regions: { id: string; code: string }[], units: { id: string; code: string; regionId: string }[]) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admins = [
    { id: randomUUID(), nrp: "admin", name: "Admin PSDM Utama", role: Role.ADMIN, passwordHash, regionId: null, unitId: null },
  ];

  const damens = [
    { id: randomUUID(), nrp: "damen1", name: "Damen Demo", role: Role.DAMEN, passwordHash, regionId: null, unitId: null },
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
  clusterLabel: string | null;
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
    clusterLabel?: string | null;
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
    const clusterLabel = p.clusterLabel ?? null;
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
        clusterLabel,
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
        clusterLabel,
        rubricAnchors,
      },
    });
    created.push({ ...param, personalWeight: p.personalWeight, skillWeight: p.skillWeight, clusterLabel });
  }
  return created;
}

async function seedProgramStructure() {
  const inclenation = await seedActivity("INCLENATION", "Inclenation", 1);
  const temu0 = await seedActivity("TEMU_0", "Temu FTEIC 0 (Baseline)", 2);
  const temu1 = await seedActivity("TEMU_1", "Temu FTEIC 1", 3);
  const temu2 = await seedActivity("TEMU_2", "Temu FTEIC 2", 4);
  const temu3 = await seedActivity("TEMU_3", "Temu FTEIC 3", 5);
  const temu31 = await seedActivity("TEMU_3_1", "Temu FTEIC 3.1 (Refleksi)", 6);
  const proker = await seedActivity("PROKER", "Proker Fakultas", 7, true);

  const inclUmum = await seedSession(inclenation.id, "UMUM", "Umum", SessionMode.NA);
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

  const temu31Umum = await seedSession(temu31.id, "UMUM", "Umum", SessionMode.NA);
  await seedSession(temu31.id, "3.1", "Temu FTEIC 3.1", SessionMode.OFFLINE);
  temuSessions["TEMU_3_1"] = { umum: temu31Umum };

  for (const name of ["Pesraf", "Arus Emas", "Soscom", "Diesnat", "Company Expo"]) {
    await seedSession(proker.id, name.toUpperCase().replace(/\s+/g, "_"), name, SessionMode.OFFLINE);
  }

  // --- Inclenation materials ---
  const kwya = await seedMaterialWithParams(
    inclenation.id,
    "KWYA",
    "Know Who You Are",
    1,
    [
      { subCode: "C.1", name: "Pengenalan Diri & Analisis SWOT (The Foundation)", type: ParameterType.B, personalWeight: 0.1172, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 1, clusterLabel: "Intrapersonal & Self-Mastery" },
      { subCode: "B.1_1", name: "Self-Awareness", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 2, clusterLabel: "Intrapersonal & Self-Mastery" },
      { subCode: "B.1_2", name: "Self-Regulation", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 3, clusterLabel: "Intrapersonal & Self-Mastery" },
      { subCode: "B.1_3", name: "Internal Motivation", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 4, clusterLabel: "Intrapersonal & Self-Mastery" },
      { subCode: "B.1_4", name: "Penentuan Target dengan SMART Goals", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 5, clusterLabel: "Strategic Planning" },
      { subCode: "B.1_5", name: "Skala Prioritas: Eisenhower Matrix", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 6, clusterLabel: "Strategic Planning" },
      { subCode: "C.2_1", name: "Adaptabilitas & Agility (Sistem & Sosial)", type: ParameterType.B, personalWeight: 0.0476, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 7, clusterLabel: "Interpersonal & Agility" },
      { subCode: "C.2_2", name: "Social Skill Management", type: ParameterType.B, personalWeight: 0.0476, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 8, clusterLabel: "Interpersonal & Agility" },
    ]
  );

  const bmb = await seedMaterialWithParams(
    inclenation.id,
    "BMB",
    "Berani Menjadi Berbeda",
    2,
    [
      { subCode: "B.1_1", name: "Dikotomi Kendali", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 1, clusterLabel: "Pengendalian Diri & Nilai" },
      { subCode: "B.1_2", name: "Prioritas Nilai (Selective Caring)", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 2, clusterLabel: "Pengendalian Diri & Nilai" },
      { subCode: "B.1_3", name: "Keberanian Tidak Disukai", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 3, clusterLabel: "Ketegasan & Batasan" },
      { subCode: "B.1_4", name: "Boundary Setting (Melepas Beban Ekspektasi)", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 4, clusterLabel: "Ketegasan & Batasan" },
    ]
  );

  const wawasanTeknologi = await seedMaterialWithParams(inclenation.id, "WAWASAN_TEKNOLOGI", "Wawasan Teknologi", 3, [
    { subCode: "C.1_1", name: "Berpikir Kritis", type: ParameterType.B, personalWeight: 0.1172, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 1, clusterLabel: "Substansi & Logika Berpikir" },
    { subCode: "C.1_2", name: "Kreativitas", type: ParameterType.B, personalWeight: 0.1172, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 2, clusterLabel: "Inovasi & Penyajian Visual" },
    { subCode: "B.2", name: "Public Speaking", type: ParameterType.B, personalWeight: 0.1755, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 3, clusterLabel: "Komunikasi & Presentasi" },
  ]);

  const wawasanFteic = await seedMaterialWithParams(inclenation.id, "WAWASAN_FTEIC", "Wawasan FTEIC", 4, [
    { subCode: "A.2_1", name: "Pengenalan FTEIC", type: ParameterType.B, personalWeight: 0.3787, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 1, clusterLabel: "Pemahaman Institusi & Struktur" },
    { subCode: "A.2_2", name: "Departemen FTEIC", type: ParameterType.B, personalWeight: 0.3787, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 2, clusterLabel: "Pemahaman Institusi & Struktur" },
    { subCode: "A.2_3", name: "Ormawa FTEIC", type: ParameterType.B, personalWeight: 0.3787, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 3, clusterLabel: "Keterlibatan & Nilai" },
    { subCode: "A.2_4", name: "Budaya FTEIC", type: ParameterType.B, personalWeight: 0.3787, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 4, clusterLabel: "Keterlibatan & Nilai" },
  ]);

  const marsElectics = await seedMaterialWithParams(inclenation.id, "MARS_ELECTICS", "Mars Electics", 5, [
    { subCode: "A.2", name: "Hafalan & Penghayatan Mars Electics", type: ParameterType.B, personalWeight: 0.3787, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 1 },
  ]);

  const jad = await seedMaterialWithParams(temu1.id, "JAD", "Jangan Asal Debat", 1, [
    { subCode: "C.1", name: "Mengadopsi Pola Pikir Ilmuwan", type: ParameterType.B, personalWeight: 0.1172, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 1, clusterLabel: "Objektivitas & Keterbukaan" },
    { subCode: "B.1", name: "Memisahkan Identitas dari Ide", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 2, clusterLabel: "Objektivitas & Keterbukaan" },
    { subCode: "C.1_B.2_1", name: "Mempraktikkan Confident Humility", type: ParameterType.B, personalWeight: 0.1755, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 3, clusterLabel: "Objektivitas & Keterbukaan" },
    { subCode: "C.1_B.2_2", name: "Mencari Konflik Tugas, Menghindari Konflik Hubungan", type: ParameterType.B, personalWeight: 0.1755, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 4, clusterLabel: "Manajemen Konflik" },
  ]);

  const htwf = await seedMaterialWithParams(temu2.id, "HTWF", "How to Win Friends and Influence People", 1, [
    { subCode: "C.2_1", name: "Genuine Interest & Smile", type: ParameterType.B, personalWeight: 0.0476, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 1, clusterLabel: "Komunikasi Empatik" },
    { subCode: "C.2_2", name: "Validasi & Apresiasi Jujur (The Power of Importance)", type: ParameterType.B, personalWeight: 0.0476, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 2, clusterLabel: "Komunikasi Empatik" },
    { subCode: "C.2_5", name: "Inklusivitas: Bertanya, Bukan Memerintah", type: ParameterType.B, personalWeight: 0.0476, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 3, clusterLabel: "Komunikasi Empatik" },
    { subCode: "B.1", name: "Integritas: Berani Mengakui Kesalahan", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 4, clusterLabel: "Manajemen Hubungan" },
    { subCode: "C.2_3", name: "Menghargai Opini & Anti Debat Kusir", type: ParameterType.B, personalWeight: 0.0476, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 5, clusterLabel: "Manajemen Hubungan" },
    { subCode: "C.2_4", name: "Indirect Approach (Mengkritik Tanpa Menyakiti)", type: ParameterType.B, personalWeight: 0.0476, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 6, clusterLabel: "Manajemen Hubungan" },
    { subCode: "C.2_6", name: "Prinsip Timbal Balik: 'Kotori Tanganmu'", type: ParameterType.B, personalWeight: 0.0476, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 7, clusterLabel: "Manajemen Hubungan" },
  ]);

  const wuwe = await seedMaterialWithParams(temu3.id, "WUWE", "Win Urself Win Everything", 1, [
    { subCode: "B.1_1", name: "Kemenangan Pribadi Sebelum Kemenangan Publik", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 1, clusterLabel: "Proaktivitas & Tanggung Jawab" },
    { subCode: "C.2", name: "Habit 1: Be Proactive", type: ParameterType.B, personalWeight: 0.0476, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 2, clusterLabel: "Proaktivitas & Tanggung Jawab" },
    { subCode: "B.1_2", name: "Habit 2: Begin with the End in Mind", type: ParameterType.B, personalWeight: 0.2609, skillWeight: null, maxValue: 4, inputMethod: InputMethod.MENTOR, order: 3, clusterLabel: "Visi & Tujuan" },
  ]);

  // Unlike the personal-value materials, each skill category's 3 dimensions
  // (Keaktifan/Minat/Potensi) are deliberately NOT clustered into one input —
  // a maba can genuinely score differently across them (e.g. logs entries
  // often but shows little real interest), so the mentor rates each of the
  // 12 dimensions on its own. lib/scoring/calculate.ts's prefix-based skill
  // matching (subCode "M_1"/"M_2"/"M_3" all roll up into the same Manajerial
  // bucket, etc.) still averages them into the 4 category scores.
  const skillDimensions = ["Keaktifan", "Minat", "Potensi"] as const;
  const skillCategories = [
    { prefix: "M", label: "Manajerial" },
    { prefix: "K", label: "Keilmiahan" },
    { prefix: "MB", label: "Minat Bakat" },
    { prefix: "KW", label: "Kewirausahaan" },
  ] as const;
  const logbookEvaluation = await seedMaterialWithParams(
    temu31.id,
    "LOGBOOK_EVAL",
    "Evaluasi Logbook (Keahlian)",
    1,
    skillCategories.flatMap((category, ci) =>
      skillDimensions.map((dimension, di) => ({
        subCode: `${category.prefix}_${di + 1}`,
        name: `${category.label} — ${dimension}`,
        type: ParameterType.B,
        personalWeight: null,
        skillWeight: 0.25 / skillDimensions.length,
        maxValue: 4,
        inputMethod: InputMethod.MENTOR,
        order: ci * skillDimensions.length + di + 1,
      })),
    ),
  );

  return {
    inclenation,
    temu0,
    temu1,
    temu2,
    temu3,
    temu31,
    proker,
    inclUmum,
    temuSessions,
    inclenationParams: { kwya, bmb, wawasanTeknologi, wawasanFteic, marsElectics },
    temuMaterialParams: {
      TEMU_1: { jad },
      TEMU_2: { htwf },
      TEMU_3: { wuwe },
      TEMU_3_1: { logbookEvaluation },
    },
  };
}

/**
 * Builds every demo row in memory and inserts each model with ONE createMany
 * call instead of one create() per row — the previous version did on the
 * order of several thousand sequential awaited round-trips (a findUnique +
 * a create per parameter per student, for every showcase-unit student),
 * which took tens of minutes against a remote Postgres instance. Nothing
 * here depends on a previous row's generated id (all ids are pre-generated
 * via randomUUID()), so batching is safe.
 */
async function seedDemoDataForShowcaseUnits(
  units: Array<{ id: string; code: string; regionId: string }>,
  allStudentsByUnit: Map<string, Array<{ id: string; nrp: string }>>,
  program: Awaited<ReturnType<typeof seedProgramStructure>>,
  mentorsByUnitId: Map<string, string>,
) {
  const showcaseUnits = units.slice(0, SHOWCASE_UNIT_COUNT);

  const inclSessions = await prisma.activitySession.findMany({
    where: { activityId: program.inclenation.id, code: { in: ["H1", "H2"] } },
  });

  // Each material's parameters must be scored under ITS OWN activity's UMUM
  // session, not a single shared one — JAD/HTWF/WUWE/LOGBOOK_EVAL live under
  // TEMU_1/TEMU_2/TEMU_3/TEMU_3_1 respectively, not under Inclenation.
  const paramGroupsBySession: Array<{ sessionId: string; params: SeededParameter[] }> = [
    {
      sessionId: program.inclUmum.id,
      params: [
        ...program.inclenationParams.kwya,
        ...program.inclenationParams.bmb,
        ...program.inclenationParams.wawasanTeknologi,
        ...program.inclenationParams.wawasanFteic,
        ...program.inclenationParams.marsElectics,
      ],
    },
    { sessionId: program.temuSessions.TEMU_1.umum.id, params: program.temuMaterialParams.TEMU_1.jad },
    { sessionId: program.temuSessions.TEMU_2.umum.id, params: program.temuMaterialParams.TEMU_2.htwf },
    { sessionId: program.temuSessions.TEMU_3.umum.id, params: program.temuMaterialParams.TEMU_3.wuwe },
    { sessionId: program.temuSessions.TEMU_3_1.umum.id, params: program.temuMaterialParams.TEMU_3_1.logbookEvaluation },
  ];

  const personalityRows: Prisma.PersonalityProfileCreateManyInput[] = [];
  const questionnaireRows: Prisma.QuestionnaireStatusCreateManyInput[] = [];
  const logbookRows: Prisma.LogbookEntryCreateManyInput[] = [];
  const scoreRows: Prisma.ScoreCreateManyInput[] = [];
  const attendanceRows: Prisma.AttendanceCreateManyInput[] = [];

  for (const unit of showcaseUnits) {
    const students = allStudentsByUnit.get(unit.id) ?? [];
    const mentorUserId = mentorsByUnitId.get(unit.id);

    for (const student of students) {
      if (Math.random() < 0.85) {
        personalityRows.push({
          id: randomUUID(),
          studentId: student.id,
          mbtiType: pick(["INTJ", "ENFP", "ISTJ", "ESFJ", "INFP", "ENTP", "ISFP", "ESTJ"] as const),
          temperament: pick(["Sanguinis", "Koleris", "Melankolis", "Plegmatis"] as const),
          importedAt: new Date(),
        });
      }
      for (const code of [QuestionnaireCode.K1, QuestionnaireCode.K2] as const) {
        const submitted = code === QuestionnaireCode.K1 ? Math.random() < 0.9 : Math.random() < 0.4;
        questionnaireRows.push({
          id: randomUUID(),
          studentId: student.id,
          code,
          submitted,
          submittedAt: submitted ? new Date() : null,
        });
      }

      const entryCount = randomInt(2, 4);
      for (let i = 0; i < entryCount; i++) {
        const verified = Math.random() < 0.7;
        logbookRows.push({
          id: randomUUID(),
          studentId: student.id,
          periodLabel: `Minggu ${i + 1}`,
          content: `Ringkasan kegiatan minggu ${i + 1} (data demo).`,
          status: verified ? LogbookStatus.LENGKAP : LogbookStatus.BELUM_DIVERIFIKASI,
          verifiedByUserId: verified ? mentorUserId : null,
          verifiedAt: verified ? new Date() : null,
        });
      }

      if (Math.random() <= 0.7) {
        for (const group of paramGroupsBySession) {
          for (const param of group.params) {
            scoreRows.push({
              id: randomUUID(),
              studentId: student.id,
              parameterId: param.id,
              sessionId: group.sessionId,
              value: randomRubricValue(),
              enteredByUserId: mentorUserId,
              source: param.inputMethod === InputMethod.IMPORT ? ScoreSource.IMPORT : ScoreSource.MENTOR,
            });
          }
        }

        for (const session of inclSessions) {
          if (Math.random() > 0.85) continue;
          const status = Math.random() < 0.85 ? AttendanceStatus.HADIR : Math.random() < 0.7 ? AttendanceStatus.IZIN : AttendanceStatus.ALPA;
          attendanceRows.push({
            id: randomUUID(),
            studentId: student.id,
            sessionId: session.id,
            status,
            participationScore: status === AttendanceStatus.HADIR ? randomRubricValue() : null,
            mode: SessionMode.OFFLINE,
            enteredByUserId: mentorUserId,
            source: ScoreSource.MENTOR,
          });
        }
      }
    }
  }

  await Promise.all([
    prisma.personalityProfile.createMany({ data: personalityRows }),
    prisma.questionnaireStatus.createMany({ data: questionnaireRows }),
    prisma.logbookEntry.createMany({ data: logbookRows }),
  ]);
  await Promise.all([
    prisma.score.createMany({ data: scoreRows }),
    prisma.attendance.createMany({ data: attendanceRows }),
  ]);
}

async function main() {
  console.log("Seeding Portal Pengembangan MABA 26...\n");

  console.log("Cleaning existing database records...");
  await prisma.auditLog.deleteMany();
  await prisma.importRow.deleteMany();
  await prisma.import.deleteMany();
  await prisma.raportSnapshot.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.flag.deleteMany();
  await prisma.confirmation.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.groupScore.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.score.deleteMany();
  await prisma.personalityProfile.deleteMany();
  await prisma.questionnaireStatus.deleteMany();
  await prisma.logbookEntry.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.region.deleteMany();
  await prisma.department.deleteMany();
  await prisma.parameter.deleteMany();
  await prisma.material.deleteMany();
  await prisma.activitySession.deleteMany();
  await prisma.activity.deleteMany();
  console.log("Database cleaned successfully.");

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
