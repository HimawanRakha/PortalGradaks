import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AttendanceCategory, AttendanceStatus } from "@/app/generated/prisma/enums";
import { computeScoresForStudents, loadScoringContext, type ComputedScores } from "./calculate";
import {
  SETTING_KEYS,
  DEFAULT_PREDICATE_THRESHOLDS,
  RECAP_ASPECTS,
} from "./setting-keys";

export const RECAP_CACHE_TAG = "recap";

/** One maba, flattened to the numbers the recap & its Excel export need. */
export type RecapRow = {
  nrp: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  region: string;
  unit: string;
  eligible: boolean;
  reasons: string[];
  personal: number | null;
  skill: number | null;
  components: Record<"TEMU_FTEIC" | "KEGIATAN_BESAR" | "INCLENATION" | "MATERI", number | null>;
  subNilai: Record<string, number | null>;
  skillCategories: Record<string, { score: number | null; mentor: number | null; kegiatan: number | null; activities: number }>;
  attendance: Record<"INCLENATION" | "TEMU_FTEIC" | "KEGIATAN_BESAR", { attended: number; held: number; total: number }>;
  keahlianAttended: number;
  /** Kegiatan Besar session code → status (null = not held yet). */
  besarSessions: Record<string, AttendanceStatus | null>;
  /** Kegiatan Keahlian session code → status, only for kegiatan this maba has a row for. */
  keahlianSessions: Record<string, AttendanceStatus>;
};

export type RecapMeta = {
  generatedAt: string;
  personalWeights: { temuFteic: number; kegiatanBesar: number; inclenation: number; materi: number };
  skillWeights: { kegiatan: number; mentor: number };
  temuMaxAbsences: number;
  kegiatanBesarMaxAbsences: number;
  temuSessions: number;
  kegiatanBesarSessions: number;
  kegiatanBesarList: Array<{ code: string; name: string }>;
  keahlianList: Array<{ code: string; name: string; skillCategory: string | null }>;
};

export type RecapData = { rows: RecapRow[]; meta: RecapMeta };

const NO_DEPARTMENT = { code: "-", name: "Tanpa Departemen" };

/**
 * Recap rows plus every maba's full ComputedScores (keyed by NRP) — the
 * latter is far too big to cache, so only the Excel export asks for it, to
 * write the per-maba raw value log.
 */
export async function loadRecapComputation(): Promise<{ data: RecapData; computedByNrp: Map<string, ComputedScores> }> {
  const [students, ctx] = await Promise.all([
    prisma.student.findMany({
      where: { active: true },
      select: {
        id: true,
        nrp: true,
        name: true,
        department: { select: { code: true, name: true } },
        unit: { select: { code: true, name: true, region: { select: { name: true } } } },
      },
      orderBy: { nrp: "asc" },
    }),
    loadScoringContext(),
  ]);
  const computed = await computeScoresForStudents(students.map((s) => s.id));

  const rows: RecapRow[] = [];
  for (const s of students) {
    const c = computed.get(s.id);
    if (!c) continue;
    const section = (cat: AttendanceCategory) => c.attendance.find((x) => x.category === cat)!;
    const att = (cat: AttendanceCategory) => {
      const sec = section(cat);
      return { attended: sec.attendedCount, held: sec.heldCount, total: sec.totalSessions };
    };
    const comp = (code: string) => c.personal.components.find((x) => x.code === code)?.score ?? null;
    rows.push({
      nrp: s.nrp,
      name: s.name,
      departmentCode: s.department?.code ?? NO_DEPARTMENT.code,
      departmentName: s.department?.name ?? NO_DEPARTMENT.name,
      region: s.unit.region.name,
      unit: s.unit.name,
      eligible: c.eligibility.eligible,
      reasons: c.eligibility.reasons,
      personal: c.personal.score,
      skill: c.skill.score,
      components: {
        TEMU_FTEIC: comp("TEMU_FTEIC"),
        KEGIATAN_BESAR: comp("KEGIATAN_BESAR"),
        INCLENATION: comp("INCLENATION"),
        MATERI: comp("MATERI"),
      },
      subNilai: Object.fromEntries(c.personal.groups.flatMap((g) => g.subNilai.map((sub) => [sub.code, sub.score]))),
      skillCategories: Object.fromEntries(
        c.skill.categories.map((cat) => [
          cat.code,
          { score: cat.score, mentor: cat.mentorScore, kegiatan: cat.activityScore, activities: cat.activities.length },
        ]),
      ),
      attendance: {
        INCLENATION: att(AttendanceCategory.INCLENATION),
        TEMU_FTEIC: att(AttendanceCategory.TEMU_FTEIC),
        KEGIATAN_BESAR: att(AttendanceCategory.KEGIATAN_BESAR),
      },
      keahlianAttended: section(AttendanceCategory.KEAHLIAN).entries.filter((e) => e.status === AttendanceStatus.HADIR).length,
      besarSessions: Object.fromEntries(section(AttendanceCategory.KEGIATAN_BESAR).entries.map((e) => [e.sessionCode, e.status])),
      keahlianSessions: Object.fromEntries(
        section(AttendanceCategory.KEAHLIAN).entries.flatMap((e) => (e.status ? [[e.sessionCode, e.status]] : [])),
      ),
    });
  }

  const sessionCount = (cat: AttendanceCategory) => ctx.attendance.sessions.filter((x) => x.activity.attendanceCategory === cat).length;
  const besarOrder = ["PESRAF", "SOSCOM", "ARUS_EMAS_1", "ARUS_EMAS_2", "ARUS_EMAS_3", "COMPEX"];
  const rank = (code: string) => (besarOrder.includes(code) ? besarOrder.indexOf(code) : besarOrder.length);
  const kegiatanBesarList = ctx.attendance.sessions
    .filter((x) => x.activity.attendanceCategory === AttendanceCategory.KEGIATAN_BESAR)
    .map((x) => ({ code: x.code, name: x.name }))
    .sort((a, b) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code));
  const keahlianList = ctx.attendance.sessions
    .filter((x) => x.activity.attendanceCategory === AttendanceCategory.KEAHLIAN)
    .map((x) => ({ code: x.code, name: x.name, skillCategory: x.skillCategory }))
    .sort((a, b) => (a.skillCategory ?? "").localeCompare(b.skillCategory ?? "") || a.name.localeCompare(b.name));
  const data: RecapData = {
    rows,
    meta: {
      generatedAt: new Date().toISOString(),
      personalWeights: ctx.personalWeights,
      skillWeights: ctx.skillWeights,
      temuMaxAbsences: ctx.attendance.temuMaxAbsences,
      kegiatanBesarMaxAbsences: ctx.attendance.kegiatanBesarMaxAbsences,
      temuSessions: sessionCount(AttendanceCategory.TEMU_FTEIC),
      kegiatanBesarSessions: sessionCount(AttendanceCategory.KEGIATAN_BESAR),
      kegiatanBesarList,
      keahlianList,
    },
  };
  const computedByNrp = new Map<string, ComputedScores>();
  for (const s of students) {
    const c = computed.get(s.id);
    if (c) computedByNrp.set(s.nrp, c);
  }
  return { data, computedByNrp };
}

export async function loadRecapData(): Promise<RecapData> {
  return (await loadRecapComputation()).data;
}

/**
 * Scoring all ~1,400 maba reads every score/attendance row, so the result is
 * cached for 10 minutes; the recap page's "Hitung ulang" button expires it
 * immediately (updateTag) after new imports.
 */
export const getRecapData = unstable_cache(loadRecapData, ["recap-data-v3"], {
  revalidate: 600,
  tags: [RECAP_CACHE_TAG],
});

// ============================================================
// Pure statistics — shared by the page and the Excel export.
// ============================================================

export type Summary = { n: number; mean: number | null; median: number | null; min: number | null; max: number | null; std: number | null };
export type HistBin = { bin: string; layak: number; tidakLayak: number };
export type MeanItem = { code: string; label: string; mean: number | null };

export type RecapStats = {
  total: number;
  eligible: number;
  ineligible: number;
  ineligibleTemu: number;
  ineligibleBesar: number;
  personal: Summary;
  skill: Summary;
  personalHist: HistBin[];
  skillHist: HistBin[];
  components: MeanItem[];
  subNilai: MeanItem[];
  skillCategories: Array<MeanItem & { mentorMean: number | null; participationPct: number | null }>;
  attendance: Array<{ code: string; label: string; hadirPct: number | null; heldSessions: number }>;
};

export type DepartmentStat = {
  code: string;
  name: string;
  total: number;
  eligible: number;
  personalMean: number | null;
  skillMean: number | null;
};

const round = (v: number | null, d = 1) => (v === null ? null : Number(v.toFixed(d)));

export function summarize(values: Array<number | null>): Summary {
  const xs = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (xs.length === 0) return { n: 0, mean: null, median: null, min: null, max: null, std: null };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const mid = Math.floor(xs.length / 2);
  const median = xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  const std = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { n: xs.length, mean: round(mean), median: round(median), min: round(xs[0]), max: round(xs[xs.length - 1]), std: round(std) };
}

const mean = (values: Array<number | null>) => summarize(values).mean;

/** 10-point bins (0–9.9 … 90–100), split by layak / tidak layak diagregasi. */
function histogram(rows: RecapRow[], pick: (r: RecapRow) => number | null): HistBin[] {
  const bins: HistBin[] = Array.from({ length: 10 }, (_, i) => ({ bin: i === 9 ? "90–100" : `${i * 10}–${i * 10 + 9}`, layak: 0, tidakLayak: 0 }));
  for (const r of rows) {
    const v = pick(r);
    if (v === null) continue;
    const idx = Math.min(9, Math.max(0, Math.floor(v / 10)));
    if (r.eligible) bins[idx].layak++;
    else bins[idx].tidakLayak++;
  }
  return bins;
}

export const SUB_NILAI_LABELS: Record<string, string> = {
  "A.1": "Kebersamaan",
  "A.2": "Kebanggaan Fakultas",
  "B.1": "Manajemen Diri",
  "B.2": "Kerja Sama",
  "C.1": "Problem Solving",
  "C.2": "Kepekaan Sosial",
};
export const SKILL_LABELS: Record<string, string> = { M: "Manajerial", K: "Keilmiahan", MB: "Minat Bakat", KW: "Kewirausahaan" };
export const COMPONENT_LABELS: Record<string, string> = {
  TEMU_FTEIC: "Kehadiran Temu FTEIC",
  KEGIATAN_BESAR: "Kehadiran Kegiatan Besar",
  INCLENATION: "Kehadiran Inclenation",
  MATERI: "Penilaian Materi",
};
const ATTENDANCE_LABELS = { INCLENATION: "Inclenation", TEMU_FTEIC: "Temu FTEIC", KEGIATAN_BESAR: "Kegiatan Besar" } as const;

/**
 * Score averages (and the summaries) use only maba who are layak diagregasi —
 * the agreed rule that "tidak layak" data is handed to HMD, not aggregated.
 * Histograms and counts still show everyone so the full spread is visible.
 */
export function buildRecapStats(rows: RecapRow[]): RecapStats {
  const ok = rows.filter((r) => r.eligible);
  const pct = (num: number, den: number) => (den > 0 ? round((num / den) * 100) : null);

  return {
    total: rows.length,
    eligible: ok.length,
    ineligible: rows.length - ok.length,
    ineligibleTemu: rows.filter((r) => r.reasons.some((x) => x.includes("Temu FTEIC"))).length,
    ineligibleBesar: rows.filter((r) => r.reasons.some((x) => x.includes("Kegiatan Besar"))).length,
    personal: summarize(ok.map((r) => r.personal)),
    skill: summarize(ok.map((r) => r.skill)),
    personalHist: histogram(rows, (r) => r.personal),
    skillHist: histogram(rows, (r) => r.skill),
    components: Object.entries(COMPONENT_LABELS).map(([code, label]) => ({
      code,
      label,
      mean: mean(ok.map((r) => r.components[code as keyof RecapRow["components"]])),
    })),
    subNilai: Object.entries(SUB_NILAI_LABELS).map(([code, label]) => ({ code, label: `${code} ${label}`, mean: mean(ok.map((r) => r.subNilai[code])) })),
    skillCategories: Object.entries(SKILL_LABELS).map(([code, label]) => ({
      code,
      label,
      mean: mean(ok.map((r) => r.skillCategories[code]?.score ?? null)),
      mentorMean: mean(ok.map((r) => r.skillCategories[code]?.mentor ?? null)),
      participationPct: pct(ok.filter((r) => (r.skillCategories[code]?.activities ?? 0) > 0).length, ok.length),
    })),
    attendance: (Object.keys(ATTENDANCE_LABELS) as Array<keyof typeof ATTENDANCE_LABELS>).map((code) => {
      const attended = rows.reduce((a, r) => a + r.attendance[code].attended, 0);
      const held = rows.reduce((a, r) => a + r.attendance[code].held, 0);
      return { code, label: ATTENDANCE_LABELS[code], hadirPct: pct(attended, held), heldSessions: rows[0]?.attendance[code].held ?? 0 };
    }),
  };
}

export function buildDepartmentStats(rows: RecapRow[]): DepartmentStat[] {
  const byDept = new Map<string, RecapRow[]>();
  for (const r of rows) byDept.set(r.departmentCode, [...(byDept.get(r.departmentCode) ?? []), r]);
  return [...byDept.entries()]
    .map(([code, list]) => {
      const ok = list.filter((r) => r.eligible);
      return {
        code,
        name: list[0].departmentName,
        total: list.length,
        eligible: ok.length,
        personalMean: mean(ok.map((r) => r.personal)),
        skillMean: mean(ok.map((r) => r.skill)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Plain-language "where does this number come from" text — shown under each
 * chart on the page and written into the Excel "Penjelasan" sheet, built
 * from the live weights so the two never disagree with the formula.
 */
export function recapExplanations(meta: RecapMeta) {
  const p = meta.personalWeights;
  const s = meta.skillWeights;
  const pc = (w: number) => `${Math.round(w * 100)}%`;
  const minTemu = Math.max(0, meta.temuSessions - meta.temuMaxAbsences);
  const minBesar = Math.max(0, meta.kegiatanBesarSessions - meta.kegiatanBesarMaxAbsences);
  return {
    overview: [
      `Nilai Personal = ${pc(p.temuFteic)} Kehadiran Temu FTEIC + ${pc(p.kegiatanBesar)} Kehadiran Kegiatan Besar + ${pc(p.inclenation)} Kehadiran Inclenation + ${pc(p.materi)} Penilaian Materi. Porsi kehadiran sengaja dominan karena objektif; penilaian mentor bisa subjektif.`,
      `Nilai Keahlian = rata-rata 4 kategori (Manajerial, Keilmiahan, Minat Bakat, Kewirausahaan). Tiap kategori = ${pc(s.mentor)} evaluasi mentor (logbook: keaktifan, minat, potensi) + ${pc(s.kegiatan)} Kegiatan Keahlian (ikut ≥1 kegiatan di kategori itu = 100, tidak ikut = 0).`,
      `Kehadiran dihitung HADIR = 100, IZIN = 50, ALPA = 0, dirata-rata dari sesi yang sudah terlaksana. Sesi yang belum terlaksana/diimpor tidak dihitung.`,
      `Tidak layak diagregasi: absen Temu FTEIC lebih dari ${meta.temuMaxAbsences}x (wajib hadir ${minTemu} dari ${meta.temuSessions}) ATAU absen Kegiatan Besar lebih dari ${meta.kegiatanBesarMaxAbsences}x (wajib hadir ${minBesar} dari ${meta.kegiatanBesarSessions}). Nilainya tetap dihitung, tetapi tidak masuk rata-rata/statistik dan diserahkan ke HMD untuk pendampingan lanjutan.`,
      `Temu FTEIC 2 berupa kuis: maba dianggap hadir bila memiliki nilai kuis > 0. Nilai yang belum diisi mentor dihitung 0.`,
    ],
    personalHist: `Sebaran Nilai Personal per rentang 10 poin. Batang hijau = layak diagregasi, merah = tidak layak. Rata-rata dan median di atas hanya memakai maba yang layak.`,
    skillHist: `Sebaran Nilai Keahlian per rentang 10 poin, dengan pembagian layak / tidak layak yang sama.`,
    components: `Rata-rata tiap komponen penyusun Nilai Personal (skala 0–100). Komponen kehadiran yang rendah menandakan banyak maba absen; Penilaian Materi berasal dari rubrik mentor dan kuis per materi.`,
    subNilai: `Rata-rata 6 Sub-Nilai di dalam Penilaian Materi: A.1 Kebersamaan = jumlah hadir ÷ sesi wajib yang terlaksana; A.2–C.2 dari rubrik mentor/kuis tiap materi (termasuk keaktifan sesi dan nilai SOSCOM untuk C.1/C.2).`,
    skillCategories: `Rata-rata Nilai Keahlian per kategori, beserta rata-rata evaluasi mentor dan persentase maba yang ikut minimal 1 Kegiatan Keahlian di kategori tersebut.`,
    attendance: `Persentase kehadiran (HADIR ÷ sesi terlaksana) seluruh maba di tiap kelompok kegiatan wajib.`,
    departments: `Perbandingan rata-rata Nilai Personal dan Nilai Keahlian antar departemen (hanya maba yang layak diagregasi).`,
    // {sb}/{b}/{c} are filled from the live predikat thresholds by predicateExplanation().
    predicatePies:
      "Tiap lingkaran = satu aspek; potongannya adalah persentase maba (layak diagregasi) di predikat Sangat Baik ≥{sb}, Baik ≥{b}, Cukup ≥{c}, dan Kurang. Potongan Cukup + Kurang yang besar menandakan aspek yang perlu perhatian.",
    besarPies: `Tiap lingkaran = satu Kegiatan Besar: persentase maba Hadir / Izin / Alpa. Kegiatan yang datanya belum diimpor ditandai "belum terlaksana".`,
    keahlianPies: `Tiap lingkaran = satu Kegiatan Keahlian (opsional): persentase seluruh maba yang Hadir, Izin, Alpa, atau Tidak ikut (namanya tidak ada di data kegiatan). Maba yang hadir mendapat porsi kegiatan ${pc(s.kegiatan)} pada kategori keahlian kegiatan tersebut.`,
  };
}

// ============================================================
// Predikat mapping & Kegiatan Besar detail
// ============================================================

export type PredicateThresholds = typeof DEFAULT_PREDICATE_THRESHOLDS;
export type RecapSettings = { thresholds: PredicateThresholds };

/** Read fresh on every request (not cached) so Settings edits apply immediately. */
export async function getRecapSettings(): Promise<RecapSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.recapPredicateThresholds } });
  const t = (row?.value as Record<string, unknown> | undefined) ?? {};
  const num = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);
  return {
    thresholds: {
      sangatBaik: num(t.sangatBaik, DEFAULT_PREDICATE_THRESHOLDS.sangatBaik),
      baik: num(t.baik, DEFAULT_PREDICATE_THRESHOLDS.baik),
      cukup: num(t.cukup, DEFAULT_PREDICATE_THRESHOLDS.cukup),
    },
  };
}

/** Fills the predikat thresholds into the pie explanation text. */
export function predicateExplanation(template: string, t: PredicateThresholds) {
  return template.replace("{sb}", String(t.sangatBaik)).replace("{b}", String(t.baik)).replace("{c}", String(t.cukup));
}

export const PREDICATES = ["Sangat Baik", "Baik", "Cukup", "Kurang"] as const;
export type Predicate = (typeof PREDICATES)[number];

export function predicateOf(score: number, t: PredicateThresholds): Predicate {
  if (score >= t.sangatBaik) return "Sangat Baik";
  if (score >= t.baik) return "Baik";
  if (score >= t.cukup) return "Cukup";
  return "Kurang";
}

export type PredicatePie = {
  code: string;
  label: string;
  group: string;
  mean: number | null;
  n: number;
  slices: Array<{ name: Predicate; value: number; pct: number }>;
  /** % of maba in Cukup + Kurang — the "needs attention" share. */
  lowPct: number;
};

function aspectValue(r: RecapRow, code: string): number | null {
  if (code in r.subNilai) return r.subNilai[code];
  if (code in r.skillCategories) return r.skillCategories[code].score;
  if (code === "TEMU_FTEIC" || code === "KEGIATAN_BESAR" || code === "INCLENATION") return r.components[code];
  return null;
}

/** One pie per aspect: how the layak-diagregasi maba split across the 4 predikat. */
export function buildPredicatePies(rows: RecapRow[], t: PredicateThresholds): PredicatePie[] {
  const ok = rows.filter((r) => r.eligible);
  return RECAP_ASPECTS.map((a) => {
    const values = ok.map((r) => aspectValue(r, a.code)).filter((v): v is number => v !== null);
    const counts = Object.fromEntries(PREDICATES.map((p) => [p, 0])) as Record<Predicate, number>;
    for (const v of values) counts[predicateOf(v, t)]++;
    const pct = (c: number) => (values.length > 0 ? Number(((c / values.length) * 100).toFixed(1)) : 0);
    return {
      code: a.code,
      label: a.group === "Sub-Nilai Personal" ? `${a.code} ${a.label}` : a.label,
      group: a.group,
      mean: mean(values),
      n: values.length,
      slices: PREDICATES.map((p) => ({ name: p, value: counts[p], pct: pct(counts[p]) })),
      lowPct: pct(counts.Cukup + counts.Kurang),
    };
  });
}

export type BesarSessionStat = {
  code: string;
  name: string;
  held: boolean;
  hadir: number;
  izin: number;
  alpa: number;
  hadirPct: number | null;
};

/** Per Kegiatan Besar session: hadir / izin / alpa among all maba in scope. */
export function buildKegiatanBesarStats(rows: RecapRow[], meta: RecapMeta): BesarSessionStat[] {
  return meta.kegiatanBesarList.map(({ code, name }) => {
    let hadir = 0;
    let izin = 0;
    let alpa = 0;
    for (const r of rows) {
      const s = r.besarSessions[code];
      if (s === AttendanceStatus.HADIR) hadir++;
      else if (s === AttendanceStatus.IZIN) izin++;
      else if (s === AttendanceStatus.ALPA) alpa++;
    }
    const total = hadir + izin + alpa;
    return { code, name, held: total > 0, hadir, izin, alpa, hadirPct: total > 0 ? Number(((hadir / total) * 100).toFixed(1)) : null };
  });
}

export type KeahlianSessionStat = BesarSessionStat & {
  /** Skill category code (M/K/MB/KW) and its label. */
  category: string | null;
  categoryLabel: string;
  /** Maba in scope with no row for this kegiatan at all. */
  tidakIkut: number;
  total: number;
};

/**
 * Per Kegiatan Keahlian: since joining is optional, every maba in scope is
 * counted — those without a row are "Tidak ikut" — and hadirPct is the share
 * of the whole scope that attended.
 */
export function buildKeahlianStats(rows: RecapRow[], meta: RecapMeta): KeahlianSessionStat[] {
  return meta.keahlianList.map(({ code, name, skillCategory }) => {
    let hadir = 0;
    let izin = 0;
    let alpa = 0;
    for (const r of rows) {
      const s = r.keahlianSessions[code];
      if (s === AttendanceStatus.HADIR) hadir++;
      else if (s === AttendanceStatus.IZIN) izin++;
      else if (s === AttendanceStatus.ALPA) alpa++;
    }
    const total = rows.length;
    return {
      code,
      name,
      category: skillCategory,
      categoryLabel: skillCategory ? (SKILL_LABELS[skillCategory] ?? skillCategory) : "-",
      held: hadir + izin + alpa > 0,
      hadir,
      izin,
      alpa,
      tidakIkut: total - hadir - izin - alpa,
      total,
      hadirPct: total > 0 ? Number(((hadir / total) * 100).toFixed(1)) : null,
    };
  });
}

/**
 * Everything the recap page and its Excel export show for one scope (whole
 * faculty or one department) — built in one place so both stay identical.
 */
export function buildRecapView(data: RecapData, settings: RecapSettings, deptCode: string | null) {
  const { rows, meta } = data;
  const departments = buildDepartmentStats(rows);
  const activeDept = departments.find((d) => d.code === deptCode) ?? null;
  const scoped = activeDept ? rows.filter((r) => r.departmentCode === activeDept.code) : rows;
  const scopeName = activeDept ? activeDept.name : "FTEIC";
  const stats = buildRecapStats(scoped);
  const pies = buildPredicatePies(scoped, settings.thresholds);
  const besar = buildKegiatanBesarStats(scoped, meta);
  const keahlian = buildKeahlianStats(scoped, meta);
  const base = recapExplanations(meta);
  const explanations = { ...base, predicatePies: predicateExplanation(base.predicatePies, settings.thresholds) };
  return { departments, activeDept, scoped, scopeName, stats, pies, besar, keahlian, explanations };
}
