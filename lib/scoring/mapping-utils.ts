import { ParameterType } from "@/app/generated/prisma/enums";

export type ScoreCategoryMapping = {
  group: "PERSONAL" | "SKILL" | "EVENT" | "UNMAPPED";
  groupLabel: string;
  subCategoryCode: string;
  subCategoryName: string;
  fullCategoryLabel: string;
  badgeClass: string;
  explanation: string;
};

export type SubCodeSummary = {
  code: string;
  groupLabel: string;
  name: string;
  matchingRule: string;
  description: string;
  count: number;
};

/**
 * Returns structured score category mapping info based on a parameter's subCode, type, and weights.
 * This mirrors the exact logic used in `lib/scoring/calculate.ts`.
 */
export function getScoreCategoryMapping(
  subCode: string,
  type?: ParameterType | null,
  personalWeight?: number | null,
  skillWeight?: number | null
): ScoreCategoryMapping {
  const upper = (subCode || "").toUpperCase().replace(/\s+/g, "");

  // 1. Event parameters (Tipe F or explicit event competition subCodes)
  if (type === ParameterType.F || upper.startsWith("H1_") || upper.startsWith("H2_") || ["TERAKTIF", "TERDISIPLIN", "PELANGGARAN", "THRONE_BATTLE", "TERKOMPAK"].includes(upper)) {
    return {
      group: "EVENT",
      groupLabel: "Kompetisi Event",
      subCategoryCode: "EVENT",
      subCategoryName: "Event Inclenation",
      fullCategoryLabel: "Kompetisi Event Inclenation",
      badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
      explanation: "Penilaian kompetisi unit/region (Teraktif/Terdisiplin/Terkompak/Throne Battle). Tidak mempengaruhi Raport Maba.",
    };
  }

  // 2. Nilai Personal Sub-values
  if (upper.includes("A.1") || upper.includes("A1")) {
    return {
      group: "PERSONAL",
      groupLabel: "Nilai Personal",
      subCategoryCode: "A.1",
      subCategoryName: "Kebersamaan",
      fullCategoryLabel: "A. Kolektif — A.1 Kebersamaan",
      badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
      explanation: "Masuk ke Nilai Personal -> Kategori A. Kolektif -> Sub-Nilai A.1 Kebersamaan (Bobot: 2.0%).",
    };
  }

  if (upper.includes("A.2") || upper.includes("A2")) {
    return {
      group: "PERSONAL",
      groupLabel: "Nilai Personal",
      subCategoryCode: "A.2",
      subCategoryName: "Kebanggaan Fakultas",
      fullCategoryLabel: "A. Kolektif — A.2 Kebanggaan Fakultas",
      badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
      explanation: "Masuk ke Nilai Personal -> Kategori A. Kolektif -> Sub-Nilai A.2 Kebanggaan Fakultas (Bobot: 37.87%).",
    };
  }

  if (upper.includes("B.1") || upper.includes("B1")) {
    return {
      group: "PERSONAL",
      groupLabel: "Nilai Personal",
      subCategoryCode: "B.1",
      subCategoryName: "Manajemen Diri",
      fullCategoryLabel: "B. Kolaborasi — B.1 Manajemen Diri",
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
      explanation: "Masuk ke Nilai Personal -> Kategori B. Kolaborasi -> Sub-Nilai B.1 Manajemen Diri (Bobot: 26.09%).",
    };
  }

  if (upper.includes("B.2") || upper.includes("B2")) {
    return {
      group: "PERSONAL",
      groupLabel: "Nilai Personal",
      subCategoryCode: "B.2",
      subCategoryName: "Kerja sama",
      fullCategoryLabel: "B. Kolaborasi — B.2 Kerja sama",
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
      explanation: "Masuk ke Nilai Personal -> Kategori B. Kolaborasi -> Sub-Nilai B.2 Kerja sama (Bobot: 17.55%).",
    };
  }

  if (upper.includes("C.1") || upper.includes("C1")) {
    return {
      group: "PERSONAL",
      groupLabel: "Nilai Personal",
      subCategoryCode: "C.1",
      subCategoryName: "Problem Solving",
      fullCategoryLabel: "C. Kontribusi — C.1 Problem Solving",
      badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
      explanation: "Masuk ke Nilai Personal -> Kategori C. Kontribusi -> Sub-Nilai C.1 Problem Solving (Bobot: 11.72%).",
    };
  }

  if (upper.includes("C.2") || upper.includes("C2")) {
    return {
      group: "PERSONAL",
      groupLabel: "Nilai Personal",
      subCategoryCode: "C.2",
      subCategoryName: "Kepekaan Sosial",
      fullCategoryLabel: "C. Kontribusi — C.2 Kepekaan Sosial",
      badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
      explanation: "Masuk ke Nilai Personal -> Kategori C. Kontribusi -> Sub-Nilai C.2 Kepekaan Sosial (Bobot: 4.76%).",
    };
  }

  // 3. Nilai Keahlian (Skill) Categories
  const skillPrefix = upper.split(/[._]/)[0];
  if (skillPrefix === "MB") {
    return {
      group: "SKILL",
      groupLabel: "Nilai Keahlian",
      subCategoryCode: "MB",
      subCategoryName: "Minat Bakat",
      fullCategoryLabel: "Keahlian — Minat Bakat",
      badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400",
      explanation: "Masuk ke Nilai Keahlian -> Rumpun Minat Bakat.",
    };
  }
  if (skillPrefix === "M") {
    return {
      group: "SKILL",
      groupLabel: "Nilai Keahlian",
      subCategoryCode: "M",
      subCategoryName: "Manajerial",
      fullCategoryLabel: "Keahlian — Manajerial",
      badgeClass: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400",
      explanation: "Masuk ke Nilai Keahlian -> Rumpun Manajerial.",
    };
  }
  if (skillPrefix === "KW") {
    return {
      group: "SKILL",
      groupLabel: "Nilai Keahlian",
      subCategoryCode: "KW",
      subCategoryName: "Kewirausahaan",
      fullCategoryLabel: "Keahlian — Kewirausahaan",
      badgeClass: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
      explanation: "Masuk ke Nilai Keahlian -> Rumpun Kewirausahaan.",
    };
  }
  if (skillPrefix === "K") {
    return {
      group: "SKILL",
      groupLabel: "Nilai Keahlian",
      subCategoryCode: "K",
      subCategoryName: "Keilmiahan",
      fullCategoryLabel: "Keahlian — Keilmiahan",
      badgeClass: "bg-teal-500/10 text-teal-600 border-teal-500/20 dark:text-teal-400",
      explanation: "Masuk ke Nilai Keahlian -> Rumpun Keilmiahan.",
    };
  }

  // 4. Check explicit weights if subCode is non-standard
  if (personalWeight && personalWeight > 0) {
    return {
      group: "PERSONAL",
      groupLabel: "Nilai Personal",
      subCategoryCode: upper || "CUSTOM",
      subCategoryName: "Bobot Personal Khusus",
      fullCategoryLabel: `Personal Custom (${subCode})`,
      badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
      explanation: `Memiliki personalWeight (${personalWeight}) tetapi kode sub tidak menggunakan penamaan standar A1-C2.`,
    };
  }

  if (skillWeight && skillWeight > 0) {
    return {
      group: "SKILL",
      groupLabel: "Nilai Keahlian",
      subCategoryCode: upper || "CUSTOM",
      subCategoryName: "Bobot Keahlian Khusus",
      fullCategoryLabel: `Keahlian Custom (${subCode})`,
      badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400",
      explanation: `Memiliki skillWeight (${skillWeight}) tetapi kode sub tidak diawali M, K, MB, atau KW.`,
    };
  }

  // 5. Unmapped / Standalone
  return {
    group: "UNMAPPED",
    groupLabel: "Khusus / Non-Calculated",
    subCategoryCode: subCode || "-",
    subCategoryName: "Parameter Khusus",
    fullCategoryLabel: "Non-Raport / Standalone",
    badgeClass: "bg-muted text-muted-foreground border-border",
    explanation: "Parameter berdiri sendiri tanpa pemetaan ke kalkulasi Raport Maba.",
  };
}

/**
 * Standard reference mapping rules for display in reference guides.
 */
export const STANDARD_SUB_CODE_REFERENCES: Array<{
  code: string;
  category: string;
  targetGroup: string;
  weightInfo: string;
  matchingPattern: string;
  description: string;
}> = [
  {
    code: "A.1",
    category: "A. Kolektif",
    targetGroup: "Nilai Personal",
    weightInfo: "2.00%",
    matchingPattern: "Mengandung 'A.1' / 'A1' (misal: A.1_1, A1)",
    description: "Sub-Nilai Kebersamaan — Diukur dari presensi temu & kegiatan kolektif.",
  },
  {
    code: "A.2",
    category: "A. Kolektif",
    targetGroup: "Nilai Personal",
    weightInfo: "37.87%",
    matchingPattern: "Mengandung 'A.2' / 'A2' (misal: A.2_1, A.2_2)",
    description: "Sub-Nilai Kebanggaan Fakultas — Pengenalan FTEIC, Ormawa, Budaya & Mars.",
  },
  {
    code: "B.1",
    category: "B. Kolaborasi",
    targetGroup: "Nilai Personal",
    weightInfo: "26.09%",
    matchingPattern: "Mengandung 'B.1' / 'B1' (misal: B.1_1, B.1_2)",
    description: "Sub-Nilai Manajemen Diri — Self-awareness, dikotomi kendali, Eisenhower Matrix.",
  },
  {
    code: "B.2",
    category: "B. Kolaborasi",
    targetGroup: "Nilai Personal",
    weightInfo: "17.55%",
    matchingPattern: "Mengandung 'B.2' / 'B2' (misal: B.2, B.2_1)",
    description: "Sub-Nilai Kerja Sama — Public speaking, komunikasi, confident humility.",
  },
  {
    code: "C.1",
    category: "C. Kontribusi",
    targetGroup: "Nilai Personal",
    weightInfo: "11.72%",
    matchingPattern: "Mengandung 'C.1' / 'C1' (misal: C.1, C.1_1)",
    description: "Sub-Nilai Problem Solving — Analisis SWOT, berpikir kritis, mindset ilmuwan.",
  },
  {
    code: "C.2",
    category: "C. Kontribusi",
    targetGroup: "Nilai Personal",
    weightInfo: "4.76%",
    matchingPattern: "Mengandung 'C.2' / 'C2' (misal: C.2_1, C.2_2)",
    description: "Sub-Nilai Kepekaan Sosial — Genuine interest, inklusivitas, indirect approach.",
  },
  {
    code: "M",
    category: "Rumpun Manajerial",
    targetGroup: "Nilai Keahlian",
    weightInfo: "Rata-rata Keahlian (25%)",
    matchingPattern: "Prefix sebelum '_' atau '.' adalah 'M' (misal: M_1, M_2)",
    description: "Evaluasi Logbook Keahlian — Keaktifan, Minat, dan Potensi Manajerial.",
  },
  {
    code: "K",
    category: "Rumpun Keilmiahan",
    targetGroup: "Nilai Keahlian",
    weightInfo: "Rata-rata Keahlian (25%)",
    matchingPattern: "Prefix sebelum '_' atau '.' adalah 'K' (misal: K_1, K_2)",
    description: "Evaluasi Logbook Keahlian — Keaktifan, Minat, dan Potensi Keilmiahan.",
  },
  {
    code: "MB",
    category: "Rumpun Minat Bakat",
    targetGroup: "Nilai Keahlian",
    weightInfo: "Rata-rata Keahlian (25%)",
    matchingPattern: "Prefix sebelum '_' atau '.' adalah 'MB' (misal: MB_1, MB_2)",
    description: "Evaluasi Logbook Keahlian — Keaktifan, Minat, dan Potensi Minat Bakat.",
  },
  {
    code: "KW",
    category: "Rumpun Kewirausahaan",
    targetGroup: "Nilai Keahlian",
    weightInfo: "Rata-rata Keahlian (25%)",
    matchingPattern: "Prefix sebelum '_' atau '.' adalah 'KW' (misal: KW_1, KW_2)",
    description: "Evaluasi Logbook Keahlian — Keaktifan, Minat, dan Potensi Kewirausahaan.",
  },
  {
    code: "EVENT",
    category: "Kompetisi Event",
    targetGroup: "Event Inclenation",
    weightInfo: "Non-Raport",
    matchingPattern: "Tipe F / Kode: TERAKTIF, TERDISIPLIN, PELANGGARAN, dll.",
    description: "Penilaian juara unit/region (Teraktif, Terdisiplin, Pelanggaran, Terkompak, Throne Battle).",
  },
];
