import "server-only";
import { prisma } from "@/lib/prisma";
import { AttendanceCategory, AttendanceStatus } from "@/app/generated/prisma/enums";
import {
  SETTING_KEYS,
  DEFAULT_ATTENDANCE_STATUS_SCORES,
  DEFAULT_PARTICIPATION_MAPPING,
  DEFAULT_TEMU_ABSENCE_THRESHOLD,
  DEFAULT_KEGIATAN_BESAR_ABSENCE_THRESHOLD,
  DEFAULT_PERSONAL_COMPONENT_WEIGHTS,
  DEFAULT_SKILL_COMPONENT_WEIGHTS,
} from "./setting-keys";
import {
  buildAttendanceSections,
  loadAttendanceContext,
  type AttendanceContext,
  type AttendanceSection,
  type StudentAttendanceRow,
} from "./attendance-summary";

export { SETTING_KEYS, DEFAULT_ATTENDANCE_STATUS_SCORES, DEFAULT_PARTICIPATION_MAPPING };

/** Where one raw value came from — shown on the raport's "nilai dari mana" detail. */
export type ItemOrigin = "MENTOR" | "IMPORT" | "KELOMPOK" | "KOSONG" | "KEAKTIFAN" | "KEHADIRAN";

export type WeightedItem = {
  label: string;
  refCode: string;
  /** e.g. "KWYA · INCLENATION" — the materi and kegiatan this value belongs to. */
  source: string;
  origin: ItemOrigin;
  /** Sub-Nilai codes (A.1…C.2) or skill category codes (M/K/MB/KW) this value feeds. */
  targets: string[];
  rawValue: number;
  maxValue: number;
  normalizedValue: number; // 0-100
  weight: number;
  weightedContribution: number;
};

export type BucketResult = {
  score: number | null;
  items: WeightedItem[];
  breakdown: Record<string, number | null>;
};

// "Penilaian Materi" keeps the labeled hierarchy: 3 top-level Nilai
// (Kolektif/Kolaborasi/Kontribusi), each made of 2 named Sub-Nilai, every
// group's score a weighted average of its children using the same fixed
// weights as the flat breakdown.
export type SubNilai = { code: string; label: string; weight: number; score: number | null };
export type NilaiGroup = { code: string; label: string; weight: number; score: number | null; subNilai: SubNilai[] };

/**
 * One of the four parts Nilai Personal is blended from. `weight` is the
 * configured share; `effectiveWeight` is after dropping components that have
 * no data yet and re-normalizing the rest (0 when this one is dropped).
 */
export type PersonalComponent = {
  code: "TEMU_FTEIC" | "KEGIATAN_BESAR" | "INCLENATION" | "MATERI";
  label: string;
  weight: number;
  effectiveWeight: number;
  score: number | null;
};

export type SkillCategory = {
  code: string;
  label: string;
  score: number | null;
  mentorScore: number | null;
  /** Kegiatan Keahlian part — null when no kegiatan in this category was attended. */
  activityScore: number | null;
  activities: string[];
};

export type Eligibility = { eligible: boolean; reasons: string[] };

export type ComputedScores = {
  personal: BucketResult & { groups: NilaiGroup[]; components: PersonalComponent[]; materiScore: number | null };
  skill: BucketResult & { categories: SkillCategory[] };
  attendance: AttendanceSection[];
  eligibility: Eligibility;
  computedAt: string;
};

function normalize(value: number, max: number): number {
  const safeMax = max > 0 ? max : 1;
  return (Math.max(0, Math.min(value, safeMax)) / safeMax) * 100;
}

// Fixed Sub-Nilai weights inside "Penilaian Materi".
const SUB_NILAI_WEIGHTS = {
  "A.1": 0.02,
  "A.2": 0.3787,
  "B.1": 0.2609,
  "B.2": 0.1755,
  "C.1": 0.1172,
  "C.2": 0.0476,
} as const;
type SubNilaiCode = keyof typeof SUB_NILAI_WEIGHTS;
const SUB_NILAI_CODES = Object.keys(SUB_NILAI_WEIGHTS) as SubNilaiCode[];

const SKILL_CATEGORY_LABELS: Array<{ code: string; label: string }> = [
  { code: "M", label: "Manajerial" },
  { code: "K", label: "Keilmiahan" },
  { code: "MB", label: "Minat Bakat" },
  { code: "KW", label: "Kewirausahaan" },
];

/** Sub-Nilai codes a parameter subCode feeds, e.g. "C.1_B.2_1" → ["B.2", "C.1"]. */
function subNilaiTargets(subCode: string): SubNilaiCode[] {
  const upper = subCode.toUpperCase().replace(/\s+/g, "");
  return SUB_NILAI_CODES.filter((code) => upper.includes(code) || upper.includes(code.replace(".", "")));
}

/**
 * Skill categories are matched on the subCode's prefix before its first
 * "_"/"." (e.g. "M_1" → "M") — comparing the whole prefix rather than a
 * plain `.includes("M")` keeps "MB_1"/"KW_1" from also matching "M"/"K".
 */
function skillTarget(subCode: string): string | null {
  const prefix = subCode.toUpperCase().replace(/\s+/g, "").split(/[._]/)[0];
  return SKILL_CATEGORY_LABELS.some((c) => c.code === prefix) ? prefix : null;
}

function readNumberSetting(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function readWeights<T extends Record<string, number>>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "object") return fallback;
  const out = { ...fallback };
  for (const key of Object.keys(fallback) as Array<keyof T>) {
    const v = (value as Record<string, unknown>)[key as string];
    if (typeof v === "number" && v >= 0) out[key] = v as T[keyof T];
  }
  return out;
}

const avg = (list: number[]) =>
  list.length > 0 ? Number((list.reduce((a, b) => a + b, 0) / list.length).toFixed(3)) : null;

/** Weighted average over the non-null parts, re-normalizing the weights. */
function blend(parts: Array<{ score: number | null; weight: number }>): number | null {
  let sum = 0;
  let weightSum = 0;
  for (const p of parts) {
    if (p.score === null || p.weight <= 0) continue;
    sum += p.score * p.weight;
    weightSum += p.weight;
  }
  return weightSum > 0 ? Number((sum / weightSum).toFixed(3)) : null;
}

const SETTING_KEYS_USED = [
  SETTING_KEYS.attendanceStatusScores,
  SETTING_KEYS.participationMapping,
  SETTING_KEYS.temuAbsenceThreshold,
  SETTING_KEYS.kegiatanBesarAbsenceThreshold,
  SETTING_KEYS.personalComponentWeights,
  SETTING_KEYS.skillComponentWeights,
];

type ScoringParam = {
  id: string;
  subCode: string;
  name: string;
  personalWeight: unknown;
  skillWeight: unknown;
  maxValue: number;
  material: { name: string; code: string; activity: { name: string } };
};

/** Everything that's identical for every student — loaded once per batch. */
export type ScoringContext = {
  params: ScoringParam[];
  heldParamIds: Set<string>;
  participationMapping: Record<string, string[]>;
  personalWeights: typeof DEFAULT_PERSONAL_COMPONENT_WEIGHTS;
  skillWeights: typeof DEFAULT_SKILL_COMPONENT_WEIGHTS;
  attendance: AttendanceContext;
};

export type StudentScoringInputs = {
  scores: Array<{ parameterId: string; value: number | null; source: string }>;
  groupScores: Array<{ parameterId: string; value: number | null }>;
  attendances: StudentAttendanceRow[];
};

export async function loadScoringContext(): Promise<ScoringContext> {
  const [params, settingRows] = await Promise.all([
    // Activity.active is deliberately NOT filtered: deactivating an activity
    // only hides it from mentors, its scores still count. Only parameters
    // that actually feed a bucket (personal/skill weight set) are read, so
    // the Inclenation competition criteria (type F) never leak in.
    prisma.parameter.findMany({
      where: {
        active: true,
        material: { active: true },
        OR: [{ personalWeight: { not: null } }, { skillWeight: { not: null } }],
      },
      select: {
        id: true,
        subCode: true,
        name: true,
        personalWeight: true,
        skillWeight: true,
        maxValue: true,
        material: { select: { name: true, code: true, activity: { select: { name: true } } } },
      },
      orderBy: { order: "asc" },
    }),
    prisma.setting.findMany({ where: { key: { in: SETTING_KEYS_USED } } }),
  ]);

  // A parameter nobody has a value for yet (e.g. SOSCOM before its import)
  // hasn't been held — skip it instead of zeroing the whole cohort. Per
  // student, an unentered value of a held parameter still counts as 0.
  const paramIds = params.map((p) => p.id);
  const [scoredParams, groupScoredParams] = await Promise.all([
    prisma.score.groupBy({ by: ["parameterId"], where: { parameterId: { in: paramIds }, value: { not: null } } }),
    prisma.groupScore.groupBy({ by: ["parameterId"], where: { parameterId: { in: paramIds }, value: { not: null } } }),
  ]);
  const setting = (key: string) => settingRows.find((s) => s.key === key)?.value;
  const statusScores = (setting(SETTING_KEYS.attendanceStatusScores) as Record<string, number> | undefined) ?? DEFAULT_ATTENDANCE_STATUS_SCORES;

  return {
    params,
    heldParamIds: new Set([...scoredParams, ...groupScoredParams].map((g) => g.parameterId)),
    participationMapping:
      (setting(SETTING_KEYS.participationMapping) as Record<string, string[]> | undefined) ?? DEFAULT_PARTICIPATION_MAPPING,
    personalWeights: readWeights(setting(SETTING_KEYS.personalComponentWeights), DEFAULT_PERSONAL_COMPONENT_WEIGHTS),
    skillWeights: readWeights(setting(SETTING_KEYS.skillComponentWeights), DEFAULT_SKILL_COMPONENT_WEIGHTS),
    attendance: await loadAttendanceContext({
      statusScores,
      temuMaxAbsences: readNumberSetting(setting(SETTING_KEYS.temuAbsenceThreshold), DEFAULT_TEMU_ABSENCE_THRESHOLD),
      kegiatanBesarMaxAbsences: readNumberSetting(
        setting(SETTING_KEYS.kegiatanBesarAbsenceThreshold),
        DEFAULT_KEGIATAN_BESAR_ABSENCE_THRESHOLD,
      ),
    }),
  };
}

async function loadStudentInputs(ctx: ScoringContext, studentIds: string[]): Promise<Map<string, StudentScoringInputs>> {
  const sessionIds = ctx.attendance.sessions.map((s) => s.id);
  const [students, attendances] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        scores: { select: { parameterId: true, value: true, source: true } },
        groupMemberships: { select: { group: { select: { groupScores: { select: { parameterId: true, value: true } } } } } },
      },
    }),
    prisma.attendance.findMany({
      where: { studentId: { in: studentIds }, sessionId: { in: sessionIds } },
      select: { studentId: true, sessionId: true, status: true, participationScore: true },
    }),
  ]);
  const byStudent = new Map<string, StudentScoringInputs>();
  for (const st of students) {
    byStudent.set(st.id, {
      scores: st.scores,
      groupScores: st.groupMemberships.flatMap((m) => m.group.groupScores),
      attendances: [],
    });
  }
  for (const a of attendances) byStudent.get(a.studentId)?.attendances.push(a);
  return byStudent;
}

export async function computeScores(studentId: string): Promise<ComputedScores> {
  const ctx = await loadScoringContext();
  const inputs = (await loadStudentInputs(ctx, [studentId])).get(studentId);
  if (!inputs) throw new Error(`Maba ${studentId} tidak ditemukan.`);
  return computeFromInputs(ctx, inputs);
}

/**
 * Same result as computeScores() per student, but shared data is loaded once
 * and every student's raw rows come in a few bulk queries — the practical way
 * to score the whole cohort (recap, exports, finalization).
 */
export async function computeScoresForStudents(studentIds: string[]): Promise<Map<string, ComputedScores>> {
  const ctx = await loadScoringContext();
  const result = new Map<string, ComputedScores>();
  const CHUNK = 500;
  for (let i = 0; i < studentIds.length; i += CHUNK) {
    const inputs = await loadStudentInputs(ctx, studentIds.slice(i, i + CHUNK));
    for (const [id, input] of inputs) result.set(id, computeFromInputs(ctx, input));
  }
  return result;
}

/** Pure: the whole raport for one student from preloaded data, no queries. */
export function computeFromInputs(ctx: ScoringContext, input: StudentScoringInputs): ComputedScores {
  const { params, heldParamIds, participationMapping, personalWeights, skillWeights } = ctx;
  const derivedAttendedSet = new Set<string>();
  for (const s of input.scores) {
    const activityId = ctx.attendance.derivedParamActivity.get(s.parameterId);
    if (activityId && s.value !== null && s.value > 0) derivedAttendedSet.add(activityId);
  }
  const attendance = buildAttendanceSections(ctx.attendance, input.attendances, derivedAttendedSet);
  const section = (category: AttendanceCategory) => attendance.find((s) => s.category === category)!;

  // ---- Penilaian Materi (mentor rubric + imported quizzes) ----
  const subScores: Record<SubNilaiCode, number[]> = { "A.1": [], "A.2": [], "B.1": [], "B.2": [], "C.1": [], "C.2": [] };
  const skillMentorScores: Record<string, number[]> = { M: [], K: [], MB: [], KW: [] };
  const personalItems: WeightedItem[] = [];
  const skillItems: WeightedItem[] = [];

  const valueMap = new Map<string, { value: number | null; origin: ItemOrigin }>();
  for (const s of input.scores) {
    valueMap.set(s.parameterId, { value: s.value, origin: s.source === "IMPORT" ? "IMPORT" : "MENTOR" });
  }
  for (const gs of input.groupScores) {
    if (!valueMap.has(gs.parameterId)) valueMap.set(gs.parameterId, { value: gs.value, origin: "KELOMPOK" });
  }

  // An unentered parameter counts as 0 — "kosong = 0" is the agreed rule.
  for (const param of params) {
    if (!heldParamIds.has(param.id)) continue;
    const entry = valueMap.get(param.id);
    const value = entry?.value ?? 0;
    const origin: ItemOrigin = entry && entry.value !== null ? entry.origin : "KOSONG";
    const normalized = normalize(value, param.maxValue);
    const source = `${param.material.name} · ${param.material.activity.name}`;

    if (param.personalWeight !== null) {
      const targets = subNilaiTargets(param.subCode);
      for (const t of targets) subScores[t].push(normalized);
      if (targets.length > 0) {
        const weight = Number(param.personalWeight);
        personalItems.push({
          label: param.name,
          refCode: param.subCode,
          source,
          origin,
          targets,
          rawValue: value,
          maxValue: param.maxValue,
          normalizedValue: normalized,
          weight,
          weightedContribution: normalized * weight,
        });
      }
    }
    if (param.skillWeight !== null) {
      const target = skillTarget(param.subCode);
      if (target) {
        skillMentorScores[target].push(normalized);
        const weight = Number(param.skillWeight);
        skillItems.push({
          label: param.name,
          refCode: param.subCode,
          source,
          origin,
          targets: [target],
          rawValue: value,
          maxValue: param.maxValue,
          normalizedValue: normalized,
          weight,
          weightedContribution: normalized * weight,
        });
      }
    }
  }

  // A.1 Kebersamaan is purely attendance: sessions attended / all held
  // mandatory sessions (Inclenation + Temu FTEIC + Kegiatan Besar), where
  // anything but HADIR counts 0. Kegiatan Keahlian is optional, so it's left
  // out of the denominator.
  const mandatoryEntries = attendance
    .filter((s) => s.category !== AttendanceCategory.KEAHLIAN)
    .flatMap((s) => s.entries.filter((e) => e.status !== null));
  if (mandatoryEntries.length > 0) {
    const hadir = mandatoryEntries.filter((e) => e.status === AttendanceStatus.HADIR).length;
    subScores["A.1"] = [(hadir / mandatoryEntries.length) * 100];
    for (const e of mandatoryEntries) {
      const attended = e.status === AttendanceStatus.HADIR;
      personalItems.push({
        label: `Kehadiran ${e.sessionName}`,
        refCode: "ATTENDANCE",
        source: e.activityName,
        origin: "KEHADIRAN",
        targets: ["A.1"],
        rawValue: attended ? 1 : 0,
        maxValue: 1,
        normalizedValue: attended ? 100 : 0,
        weight: 0,
        weightedContribution: 0,
      });
    }
  }

  // Mentor-entered keaktifan (1-4) per session still feeds Penilaian Materi.
  for (const sec of attendance) {
    for (const e of sec.entries) {
      if (e.status !== AttendanceStatus.HADIR || !e.participationScore || e.participationScore <= 0) continue;
      const mapped = participationMapping[e.sessionCode] || participationMapping["DEFAULT"] || ["B.2", "C.1"];
      const targets = SUB_NILAI_CODES.filter((code) => mapped.some((m) => m.toUpperCase().trim() === code));
      const normalized = normalize(e.participationScore, 4);
      for (const t of targets) subScores[t].push(normalized);
      if (targets.length > 0) {
        personalItems.push({
          label: `Keaktifan ${e.sessionName}`,
          refCode: "PARTICIPATION",
          source: e.activityName,
          origin: "KEAKTIFAN",
          targets,
          rawValue: e.participationScore,
          maxValue: 4,
          normalizedValue: normalized,
          weight: 0,
          weightedContribution: 0,
        });
      }
    }
  }

  const sub = Object.fromEntries(SUB_NILAI_CODES.map((c) => [c, avg(subScores[c])])) as Record<SubNilaiCode, number | null>;
  const materiScore = blend(SUB_NILAI_CODES.map((c) => ({ score: sub[c], weight: SUB_NILAI_WEIGHTS[c] })));

  const groupOf = (code: string, label: string, weight: number, children: Array<[SubNilaiCode, string]>): NilaiGroup => ({
    code,
    label,
    weight,
    score: blend(children.map(([c]) => ({ score: sub[c], weight: SUB_NILAI_WEIGHTS[c] }))),
    subNilai: children.map(([c, l]) => ({ code: c, label: l, weight: SUB_NILAI_WEIGHTS[c], score: sub[c] })),
  });
  const groups: NilaiGroup[] = [
    groupOf("A", "Kolektif", 0.399, [["A.1", "Kebersamaan"], ["A.2", "Kebanggaan Fakultas"]]),
    groupOf("B", "Kolaborasi", 0.4364, [["B.1", "Manajemen Diri (emosi/waktu)"], ["B.2", "Kerja sama"]]),
    groupOf("C", "Kontribusi", 0.1648, [["C.1", "Problem Solving"], ["C.2", "Kepekaan Sosial"]]),
  ];

  // ---- Nilai Personal = objective attendance sections + Penilaian Materi ----
  const rawComponents: Array<Omit<PersonalComponent, "effectiveWeight">> = [
    { code: "TEMU_FTEIC", label: "Kehadiran Temu FTEIC", weight: personalWeights.temuFteic, score: section(AttendanceCategory.TEMU_FTEIC).score },
    { code: "KEGIATAN_BESAR", label: "Kehadiran Kegiatan Besar", weight: personalWeights.kegiatanBesar, score: section(AttendanceCategory.KEGIATAN_BESAR).score },
    { code: "INCLENATION", label: "Kehadiran Inclenation", weight: personalWeights.inclenation, score: section(AttendanceCategory.INCLENATION).score },
    { code: "MATERI", label: "Penilaian Materi", weight: personalWeights.materi, score: materiScore },
  ];
  const activeWeightSum = rawComponents.reduce((s, c) => s + (c.score !== null ? c.weight : 0), 0);
  const components: PersonalComponent[] = rawComponents.map((c) => ({
    ...c,
    effectiveWeight: c.score !== null && activeWeightSum > 0 ? Number((c.weight / activeWeightSum).toFixed(4)) : 0,
  }));
  const personalScore = blend(components);

  // ---- Nilai Keahlian: mentor evaluation (+ optional Kegiatan Keahlian) per category ----
  const keahlian = section(AttendanceCategory.KEAHLIAN);
  const categories: SkillCategory[] = SKILL_CATEGORY_LABELS.map(({ code, label }) => {
    const mentorScore = avg(skillMentorScores[code]);
    const attended = keahlian.entries.filter((e) => e.skillCategory === code && e.status === AttendanceStatus.HADIR);
    // Joined ≥1 kegiatan in this category = full kegiatan half, none = 0 —
    // but only once this category has any kegiatan at all (null = not held yet).
    const activityScore = attended.length > 0 ? 100 : keahlian.heldSkillCategories.includes(code) ? 0 : null;
    return {
      code,
      label,
      mentorScore,
      activityScore,
      activities: attended.map((e) => e.sessionName),
      score: blend([
        { score: mentorScore, weight: skillWeights.mentor },
        { score: activityScore, weight: skillWeights.kegiatan },
      ]),
    };
  });
  const skillScore = avg(categories.flatMap((c) => (c.score !== null ? [c.score] : [])));

  const reasons = attendance
    .filter((s) => !s.eligible)
    .map((s) => `Absen ${s.label} ${s.absences}x (maksimal ${s.maxAbsences}x)`);

  return {
    personal: {
      score: personalScore,
      items: personalItems,
      breakdown: {
        a1: sub["A.1"],
        a2: sub["A.2"],
        b1: sub["B.1"],
        b2: sub["B.2"],
        c1: sub["C.1"],
        c2: sub["C.2"],
        materi: materiScore,
        temuFteic: components[0].score,
        kegiatanBesar: components[1].score,
        inclenation: components[2].score,
      },
      groups,
      components,
      materiScore,
    },
    skill: {
      score: skillScore,
      items: skillItems,
      breakdown: Object.fromEntries(categories.map((c) => [c.code, c.score])),
      categories,
    },
    attendance,
    eligibility: { eligible: reasons.length === 0, reasons },
    computedAt: new Date().toISOString(),
  };
}
