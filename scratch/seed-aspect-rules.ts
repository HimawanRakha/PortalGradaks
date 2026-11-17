/**
 * Seeds the "Rekomendasi Pengembangan" rules (kind IMPROVE / KEEP) into
 * Master Data > Rule Rekomendasi: one "perlu ditingkatkan" rule (score < 70,
 * i.e. Cukup/Kurang) and one "pertahankan & eksplor" rule (score >= 85, i.e.
 * Sangat Baik) for Nilai Personal, each Sub-Nilai and each bidang keahlian.
 * Idempotent by rule name: existing rules are left untouched.
 *
 *   npx tsx --conditions=react-server scratch/seed-aspect-rules.ts [--apply]
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { RecommendationKind, RecommendationMetric, RuleOperator } from "../app/generated/prisma/enums";
import { METRIC_RAPORT_LABELS } from "../lib/scoring/recommendation-labels";

const M = RecommendationMetric;
const ASPECTS: Array<[RecommendationMetric, string, string]> = [
  [M.PERSONAL_SCORE,
    "Tingkatkan keterlibatan dalam kegiatan pembinaan: hadiri setiap agenda dan ikuti materi secara aktif.",
    "Pertahankan konsistensi kehadiran dan keaktifan Anda, lalu ambil peran sebagai penggerak di lingkungan angkatan."],
  [M.SUB_A1,
    "Perbanyak kehadiran dan keterlibatan dalam kegiatan bersama angkatan, himpunan, dan fakultas.",
    "Pertahankan keterlibatan Anda dan ajak teman seangkatan untuk aktif bersama."],
  [M.SUB_A2,
    "Kenali lebih jauh FTEIC, departemen, dan organisasi mahasiswanya dengan mengikuti kegiatan fakultas dan himpunan.",
    "Pertahankan rasa memiliki terhadap FTEIC dan eksplor lebih dalam melalui keterlibatan di himpunan atau BEM."],
  [M.SUB_B1,
    "Latih pengelolaan diri: tetapkan target yang jelas, susun skala prioritas, dan evaluasi kebiasaan belajar secara berkala.",
    "Pertahankan kemampuan manajemen diri Anda dan eksplor lebih dalam dengan menjadi teladan atau mentor sebaya."],
  [M.SUB_B2,
    "Latih komunikasi dan kerja tim, misalnya aktif menyampaikan pendapat dalam diskusi kelompok dan berbicara di depan forum.",
    "Pertahankan kemampuan kerja sama Anda dan eksplor lebih dalam melalui peran koordinator dalam kepanitiaan."],
  [M.SUB_C1,
    "Asah kemampuan berpikir kritis dan kreatif melalui studi kasus, proyek kecil, atau kompetisi ide.",
    "Pertahankan kemampuan pemecahan masalah Anda dan eksplor lebih dalam melalui lomba, riset, atau proyek inovasi."],
  [M.SUB_C2,
    "Tingkatkan kepedulian dan keterlibatan sosial melalui kegiatan pengabdian masyarakat atau kepanitiaan sosial.",
    "Pertahankan kepekaan sosial Anda dan eksplor lebih dalam melalui kegiatan pengabdian masyarakat."],
  [M.SKILL_MANAJERIAL,
    "Cobalah mengambil peran dalam kepanitiaan atau organisasi untuk melatih kepemimpinan dan pengelolaan kegiatan.",
    "Pertahankan potensi manajerial Anda dan eksplor lebih dalam melalui peran kepemimpinan di organisasi."],
  [M.SKILL_KEILMIAHAN,
    "Ikuti kelompok studi, kegiatan riset, atau lomba karya tulis untuk mengembangkan kemampuan keilmiahan.",
    "Pertahankan potensi keilmiahan Anda dan eksplor lebih dalam melalui riset, laboratorium, atau kompetisi akademik."],
  [M.SKILL_MINAT_BAKAT,
    "Salurkan hobi dan bakat melalui UKM, komunitas, atau kompetisi non-akademik.",
    "Pertahankan potensi minat dan bakat Anda dan eksplor lebih dalam melalui UKM atau kompetisi minat bakat."],
  [M.SKILL_KEWIRAUSAHAAN,
    "Pelajari dasar kewirausahaan melalui pelatihan bisnis atau kegiatan wirausaha mahasiswa.",
    "Pertahankan potensi kewirausahaan Anda dan eksplor lebih dalam melalui inkubasi bisnis atau kompetisi wirausaha."],
];

async function main() {
  const apply = process.argv.includes("--apply");
  const existing = new Set((await prisma.recommendationRule.findMany({ select: { name: true } })).map((r) => r.name));
  const rows = ASPECTS.flatMap(([metric, improve, keep], i) => [
    { name: `Tingkatkan — ${METRIC_RAPORT_LABELS[metric]}`, metric, kind: RecommendationKind.IMPROVE, operator: RuleOperator.LT, value: 70, descriptionText: improve, order: 101 + i },
    { name: `Pertahankan — ${METRIC_RAPORT_LABELS[metric]}`, metric, kind: RecommendationKind.KEEP, operator: RuleOperator.GTE, value: 85, descriptionText: keep, order: 201 + i },
  ]);
  const todo = rows.filter((r) => !existing.has(r.name));
  console.log(`${rows.length} rule disiapkan, ${rows.length - todo.length} sudah ada, ${todo.length} akan ditambahkan`);
  if (!apply) return console.log("dry run — tambahkan --apply untuk menyimpan");
  for (const r of todo) await prisma.recommendationRule.create({ data: { ...r, active: true } });
  const counts = await prisma.recommendationRule.groupBy({ by: ["kind"], _count: true });
  console.log("isi tabel sekarang:", counts.map((c) => `${c.kind}=${c._count}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
