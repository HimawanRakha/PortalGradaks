/**
 * Sets up the raport conclusion rules ("hasil selama pengembangan"):
 *  - 4 TOP_SKILL rules: the description of each bidang keahlian, used when it
 *    is the maba's highest-scoring bidang (the raport headline names it).
 *  - 4 HEADLINE rules: the Nilai Personal result per predikat band.
 * The old HEADLINE rules are deactivated (not deleted) so they stay visible
 * in Master Data and can be re-enabled. Idempotent by rule name.
 *
 *   npx tsx --conditions=react-server scratch/seed-conclusion-rules.ts [--apply]
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { RecommendationKind as K, RecommendationMetric as M, RuleOperator as O } from "../app/generated/prisma/enums";

const NEW_RULES = [
  { name: "Kesimpulan Bidang — Manajerial", metric: M.SKILL_MANAJERIAL, kind: K.TOP_SKILL, operator: O.GTE, value: 0, order: 11,
    descriptionText: "Anda menunjukkan kecenderungan kuat dalam kepemimpinan dan pengelolaan kegiatan. Kembangkan potensi ini melalui kepengurusan himpunan, kepanitiaan, atau organisasi kemahasiswaan." },
  { name: "Kesimpulan Bidang — Keilmiahan", metric: M.SKILL_KEILMIAHAN, kind: K.TOP_SKILL, operator: O.GTE, value: 0, order: 12,
    descriptionText: "Anda menunjukkan kecenderungan kuat dalam penalaran dan kegiatan akademik. Kembangkan potensi ini melalui kelompok studi, riset, laboratorium, atau kompetisi ilmiah." },
  { name: "Kesimpulan Bidang — Minat Bakat", metric: M.SKILL_MINAT_BAKAT, kind: K.TOP_SKILL, operator: O.GTE, value: 0, order: 13,
    descriptionText: "Anda menunjukkan kecenderungan kuat dalam minat dan bakat non-akademik. Kembangkan potensi ini melalui UKM, komunitas, atau kompetisi seni dan olahraga." },
  { name: "Kesimpulan Bidang — Kewirausahaan", metric: M.SKILL_KEWIRAUSAHAAN, kind: K.TOP_SKILL, operator: O.GTE, value: 0, order: 14,
    descriptionText: "Anda menunjukkan kecenderungan kuat dalam kewirausahaan. Kembangkan potensi ini melalui pelatihan bisnis, inkubasi usaha, atau kompetisi wirausaha." },
  { name: "Kesimpulan Personal — Sangat Baik", metric: M.PERSONAL_SCORE, kind: K.HEADLINE, operator: O.GTE, value: 85, order: 21,
    recommendationText: "Perkembangan Sangat Baik",
    descriptionText: "Selama rangkaian GRADAKS, Anda menunjukkan keterlibatan yang konsisten serta perkembangan karakter yang sangat baik dalam kebersamaan, pengelolaan diri, kerja sama, dan kontribusi." },
  { name: "Kesimpulan Personal — Baik", metric: M.PERSONAL_SCORE, kind: K.HEADLINE, operator: O.BETWEEN, value: 70, valueTo: 84.99, order: 22,
    recommendationText: "Perkembangan Baik",
    descriptionText: "Anda menunjukkan keterlibatan dan perkembangan karakter yang baik. Pertahankan konsistensi kehadiran dan keaktifan agar perkembangan Anda semakin optimal." },
  { name: "Kesimpulan Personal — Cukup", metric: M.PERSONAL_SCORE, kind: K.HEADLINE, operator: O.BETWEEN, value: 55, valueTo: 69.99, order: 23,
    recommendationText: "Perkembangan Cukup",
    descriptionText: "Perkembangan Anda sudah terlihat, tetapi keterlibatan dan keaktifan dalam kegiatan pembinaan masih perlu ditingkatkan." },
  { name: "Kesimpulan Personal — Perlu Pendampingan", metric: M.PERSONAL_SCORE, kind: K.HEADLINE, operator: O.LT, value: 55, order: 24,
    recommendationText: "Perlu Pendampingan Lanjutan",
    descriptionText: "Keterlibatan Anda dalam rangkaian pembinaan masih terbatas. Anda disarankan mendapatkan pendampingan lanjutan untuk mengoptimalkan perkembangan." },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const all = await prisma.recommendationRule.findMany();
  const names = new Set(all.map((r) => r.name));
  const newNames = new Set(NEW_RULES.map((r) => r.name));
  const toDeactivate = all.filter((r) => r.kind === K.HEADLINE && r.active && !newNames.has(r.name));
  const toCreate = NEW_RULES.filter((r) => !names.has(r.name));
  console.log(`dinonaktifkan: ${toDeactivate.map((r) => `"${r.name}"`).join(", ") || "-"}`);
  console.log(`ditambahkan: ${toCreate.length} rule`);
  if (!apply) return console.log("dry run — tambahkan --apply untuk menyimpan");
  for (const r of toDeactivate) await prisma.recommendationRule.update({ where: { id: r.id }, data: { active: false } });
  for (const r of toCreate) await prisma.recommendationRule.create({ data: { ...r, active: true } });
  const counts = await prisma.recommendationRule.groupBy({ by: ["kind", "active"], _count: true });
  console.log("isi tabel:", counts.map((c) => `${c.kind}${c.active ? "" : "(nonaktif)"}=${c._count}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
