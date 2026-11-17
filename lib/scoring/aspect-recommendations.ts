import type { ComputedScores } from "./calculate";
import type { PredicateThresholds } from "./recap";

/**
 * Specific, per-aspect development advice on the raport: every aspect below
 * the "Baik" band gets an "improve" item, every aspect in the "Sangat Baik"
 * band gets a "keep & explore deeper" item; aspects in between get none.
 * The bands are the same predicate thresholds Settings defines for the
 * recap/raport, so retuning them there retunes this too. Pure function of
 * ComputedScores, so it also works on a frozen RaportSnapshot breakdown.
 */
export type AspectAdvice = { code: string; label: string; score: number; text: string };
export type AspectRecommendations = { improve: AspectAdvice[]; keep: AspectAdvice[] };

const IMPROVE: Record<string, string> = {
  PERSONAL: "Tingkatkan keterlibatan dalam kegiatan pembinaan: hadiri setiap agenda dan ikuti materi secara aktif.",
  "A.1": "Perbanyak kehadiran dan keterlibatan dalam kegiatan bersama angkatan, himpunan, dan fakultas.",
  "A.2": "Kenali lebih jauh FTEIC, departemen, dan organisasi mahasiswanya dengan mengikuti kegiatan fakultas dan himpunan.",
  "B.1": "Latih pengelolaan diri: tetapkan target yang jelas, susun skala prioritas, dan evaluasi kebiasaan belajar secara berkala.",
  "B.2": "Latih komunikasi dan kerja tim, misalnya aktif menyampaikan pendapat dalam diskusi kelompok dan berbicara di depan forum.",
  "C.1": "Asah kemampuan berpikir kritis dan kreatif melalui studi kasus, proyek kecil, atau kompetisi ide.",
  "C.2": "Tingkatkan kepedulian dan keterlibatan sosial melalui kegiatan pengabdian masyarakat atau kepanitiaan sosial.",
  M: "Cobalah mengambil peran dalam kepanitiaan atau organisasi untuk melatih kepemimpinan dan pengelolaan kegiatan.",
  K: "Ikuti kelompok studi, kegiatan riset, atau lomba karya tulis untuk mengembangkan kemampuan keilmiahan.",
  MB: "Salurkan hobi dan bakat melalui UKM, komunitas, atau kompetisi non-akademik.",
  KW: "Pelajari dasar kewirausahaan melalui pelatihan bisnis atau kegiatan wirausaha mahasiswa.",
};

const KEEP: Record<string, string> = {
  PERSONAL: "Pertahankan konsistensi kehadiran dan keaktifan Anda, lalu ambil peran sebagai penggerak di lingkungan angkatan.",
  "A.1": "Pertahankan keterlibatan Anda dan ajak teman seangkatan untuk aktif bersama.",
  "A.2": "Pertahankan rasa memiliki terhadap FTEIC dan eksplor lebih dalam melalui keterlibatan di himpunan atau BEM.",
  "B.1": "Pertahankan kemampuan manajemen diri Anda dan eksplor lebih dalam dengan menjadi teladan atau mentor sebaya.",
  "B.2": "Pertahankan kemampuan kerja sama Anda dan eksplor lebih dalam melalui peran koordinator dalam kepanitiaan.",
  "C.1": "Pertahankan kemampuan pemecahan masalah Anda dan eksplor lebih dalam melalui lomba, riset, atau proyek inovasi.",
  "C.2": "Pertahankan kepekaan sosial Anda dan eksplor lebih dalam melalui kegiatan pengabdian masyarakat.",
  M: "Pertahankan potensi manajerial Anda dan eksplor lebih dalam melalui peran kepemimpinan di organisasi.",
  K: "Pertahankan potensi keilmiahan Anda dan eksplor lebih dalam melalui riset, laboratorium, atau kompetisi akademik.",
  MB: "Pertahankan potensi minat dan bakat Anda dan eksplor lebih dalam melalui UKM atau kompetisi minat bakat.",
  KW: "Pertahankan potensi kewirausahaan Anda dan eksplor lebih dalam melalui inkubasi bisnis atau kompetisi wirausaha.",
};

export function buildAspectRecommendations(computed: ComputedScores, t: PredicateThresholds): AspectRecommendations {
  const improve: AspectAdvice[] = [];
  const keep: AspectAdvice[] = [];
  const consider = (code: string, label: string, score: number | null, improveText?: string) => {
    if (score === null || score === undefined) return;
    if (score < t.baik) improve.push({ code, label, score, text: improveText ?? IMPROVE[code] });
    else if (score >= t.sangatBaik) keep.push({ code, label, score, text: KEEP[code] });
  };

  consider("PERSONAL", "Nilai Personal", computed.personal.score);
  for (const g of computed.personal.groups) {
    for (const sub of g.subNilai) consider(sub.code, sub.label.replace(/\s*\(.*\)$/, ""), sub.score);
  }
  for (const c of computed.skill.categories) {
    // A strong mentor evaluation dragged down only by the (optional) kegiatan
    // portion is "potential not yet channelled", not a weakness.
    const untapped =
      c.score !== null && c.score < t.baik && c.mentorScore !== null && c.mentorScore >= t.sangatBaik && (c.activityScore ?? 0) === 0;
    consider(
      c.code,
      `Bidang ${c.label}`,
      c.score,
      untapped
        ? `Potensi bidang ${c.label} Anda dinilai sangat baik oleh mentor, tetapi belum tersalurkan melalui kegiatan. ${IMPROVE[c.code]}`
        : undefined,
    );
  }
  return { improve, keep };
}
