import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AttendanceCategory, AttendanceStatus } from "@/app/generated/prisma/enums";
import { computeScoresForStudents, loadScoringContext } from "./calculate";

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
};

export type RecapMeta = {
  generatedAt: string;
  personalWeights: { temuFteic: number; kegiatanBesar: number; inclenation: number; materi: number };
  skillWeights: { kegiatan: number; mentor: number };
  temuMaxAbsences: number;
  kegiatanBesarMaxAbsences: number;
  temuSessions: number;
  kegiatanBesarSessions: number;
};

export type RecapData = { rows: RecapRow[]; meta: RecapMeta };

const NO_DEPARTMENT = { code: "-", name: "Tanpa Departemen" };

export async function loadRecapData(): Promise<RecapData> {
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
    });
  }

  const sessionCount = (cat: AttendanceCategory) => ctx.attendance.sessions.filter((x) => x.activity.attendanceCategory === cat).length;
  return {
    rows,
    meta: {
      generatedAt: new Date().toISOString(),
      personalWeights: ctx.personalWeights,
      skillWeights: ctx.skillWeights,
      temuMaxAbsences: ctx.attendance.temuMaxAbsences,
      kegiatanBesarMaxAbsences: ctx.attendance.kegiatanBesarMaxAbsences,
      temuSessions: sessionCount(AttendanceCategory.TEMU_FTEIC),
      kegiatanBesarSessions: sessionCount(AttendanceCategory.KEGIATAN_BESAR),
    },
  };
}

/**
 * Scoring all ~1,400 maba reads every score/attendance row, so the result is
 * cached for 10 minutes; the recap page's "Hitung ulang" button expires it
 * immediately (updateTag) after new imports.
 */
export const getRecapData = unstable_cache(loadRecapData, ["recap-data-v1"], {
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
  };
}
