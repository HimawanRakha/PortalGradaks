import { RecommendationKind, RecommendationMetric } from "@/app/generated/prisma/enums";

/** Admin-facing metric names (Master Data > Rule Rekomendasi). */
export const METRIC_LABELS: Record<RecommendationMetric, string> = {
  [RecommendationMetric.PERSONAL_SCORE]: "Nilai Personal (Total)",
  [RecommendationMetric.SKILL_SCORE]: "Nilai Keahlian (Total)",
  [RecommendationMetric.PERSONAL_KOLEKTIF]: "Personal — Kolektif (A)",
  [RecommendationMetric.PERSONAL_KOLABORASI]: "Personal — Kolaborasi (B)",
  [RecommendationMetric.PERSONAL_KONTRIBUSI]: "Personal — Kontribusi (C)",
  [RecommendationMetric.SUB_A1]: "Sub-Nilai A.1 Kebersamaan",
  [RecommendationMetric.SUB_A2]: "Sub-Nilai A.2 Kebanggaan Fakultas",
  [RecommendationMetric.SUB_B1]: "Sub-Nilai B.1 Manajemen Diri",
  [RecommendationMetric.SUB_B2]: "Sub-Nilai B.2 Kerja Sama",
  [RecommendationMetric.SUB_C1]: "Sub-Nilai C.1 Problem Solving",
  [RecommendationMetric.SUB_C2]: "Sub-Nilai C.2 Kepekaan Sosial",
  [RecommendationMetric.SKILL_MANAJERIAL]: "Keahlian — Manajerial (M)",
  [RecommendationMetric.SKILL_KEILMIAHAN]: "Keahlian — Keilmiahan (K)",
  [RecommendationMetric.SKILL_MINAT_BAKAT]: "Keahlian — Minat Bakat (MB)",
  [RecommendationMetric.SKILL_KEWIRAUSAHAAN]: "Keahlian — Kewirausahaan (KW)",
};

/** How an aspect is named to the maba on the raport's "Rekomendasi Pengembangan" lists. */
export const METRIC_RAPORT_LABELS: Record<RecommendationMetric, string> = {
  [RecommendationMetric.PERSONAL_SCORE]: "Nilai Personal",
  [RecommendationMetric.SKILL_SCORE]: "Nilai Keahlian",
  [RecommendationMetric.PERSONAL_KOLEKTIF]: "Kolektif",
  [RecommendationMetric.PERSONAL_KOLABORASI]: "Kolaborasi",
  [RecommendationMetric.PERSONAL_KONTRIBUSI]: "Kontribusi",
  [RecommendationMetric.SUB_A1]: "Kebersamaan",
  [RecommendationMetric.SUB_A2]: "Kebanggaan Fakultas",
  [RecommendationMetric.SUB_B1]: "Manajemen Diri",
  [RecommendationMetric.SUB_B2]: "Kerja Sama",
  [RecommendationMetric.SUB_C1]: "Problem Solving",
  [RecommendationMetric.SUB_C2]: "Kepekaan Sosial",
  [RecommendationMetric.SKILL_MANAJERIAL]: "Bidang Manajerial",
  [RecommendationMetric.SKILL_KEILMIAHAN]: "Bidang Keilmiahan",
  [RecommendationMetric.SKILL_MINAT_BAKAT]: "Bidang Minat Bakat",
  [RecommendationMetric.SKILL_KEWIRAUSAHAAN]: "Bidang Kewirausahaan",
};

export const KIND_LABELS: Record<RecommendationKind, string> = {
  [RecommendationKind.HEADLINE]: "Label & Deskripsi Raport",
  [RecommendationKind.IMPROVE]: "Pengembangan: Perlu Ditingkatkan",
  [RecommendationKind.KEEP]: "Pengembangan: Pertahankan & Eksplor",
};
