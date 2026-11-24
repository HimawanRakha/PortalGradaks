/**
 * Quick, read-only pre-publish audit of the finalized raports. Checks every
 * snapshot's stored values (no recomputation), whether any score/attendance
 * changed after finalization, the IPF list, and texts that would render badly.
 *
 *   npx tsx --conditions=react-server scratch/audit-raport.ts
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import type { ComputedScores } from "../lib/scoring/calculate";
import { SETTING_KEYS, DEFAULT_DATA_INSUFFICIENT_MESSAGE } from "../lib/scoring/setting-keys";
import { parseIpfFailedNrps } from "../lib/scoring/ipf";

async function main() {
  const problems: Record<string, string[]> = {};
  const flag = (kind: string, who: string) => (problems[kind] ??= []).push(who);

  const [students, settings, inactiveSnaps] = await Promise.all([
    prisma.student.findMany({ where: { active: true }, select: { nrp: true, name: true, departmentId: true, raportSnapshot: true } }),
    prisma.setting.findMany({
      where: { key: { in: [SETTING_KEYS.ipfFailedNrps, SETTING_KEYS.dataInsufficientMessage, SETTING_KEYS.raportPublicCheckEnabled, SETTING_KEYS.raportThankYouMessage] } },
    }),
    prisma.raportSnapshot.count({ where: { student: { active: false } } }),
  ]);
  const setting = (k: string) => settings.find((s) => s.key === k)?.value;
  const insufficientMsg = typeof setting(SETTING_KEYS.dataInsufficientMessage) === "string" ? (setting(SETTING_KEYS.dataInsufficientMessage) as string) : DEFAULT_DATA_INSUFFICIENT_MESSAGE;
  const ipf = parseIpfFailedNrps(setting(SETTING_KEYS.ipfFailedNrps));

  let layak = 0, tidak = 0, oldest = Infinity;
  for (const s of students) {
    const who = `${s.nrp} ${s.name}`;
    if (!s.departmentId) flag("Departemen kosong", who);
    if (/[^\x20-\x7E\xA0-\xFF]/.test(s.name)) flag("Nama berkarakter yang hilang di PDF", who);
    const snap = s.raportSnapshot;
    if (!snap) { flag("Belum punya snapshot", who); continue; }
    oldest = Math.min(oldest, snap.finalizedAt.getTime());
    const b = snap.breakdown as unknown as ComputedScores & { aspectRecommendations?: unknown };
    if (!b?.personal?.components || !b.attendance || !b.skill?.categories || !b.eligibility) { flag("Breakdown tidak lengkap", who); continue; }
    const ps = Number(snap.personalScore), ss = Number(snap.skillScore);
    if (![ps, ss].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) flag("Nilai di luar 0-100", who);
    if (Math.abs(ps - (b.personal.score ?? 0)) > 0.01 || Math.abs(ss - (b.skill.score ?? 0)) > 0.01) flag("Nilai berbeda dengan rinciannya", who);
    if (snap.dataInsufficient === b.eligibility.eligible) flag("Status agregasi tidak konsisten", who);
    const text = `${snap.recommendation ?? ""}\n${snap.description ?? ""}`;
    if (/undefined|null|NaN|\[object/.test(text)) flag("Teks memuat undefined/null/NaN", who);
    if (/HMD|Himpunan Mahasiswa/.test(text)) flag("Teks masih menyebut HMD", who);
    if (text.includes("Belum ada rekomendasi")) flag("Rekomendasi kosong (tidak ada rule cocok)", who);
    if ((snap.description ?? "").length > 1400) flag("Deskripsi terpotong di PDF", who);
    if (snap.dataInsufficient) {
      tidak++;
      if (snap.recommendation !== "Tidak Dapat Diagregasi" || snap.description !== insufficientMsg) flag("Teks Tidak Dapat Diagregasi tidak sesuai", who);
      if (b.aspectRecommendations) flag("Tidak layak tetapi punya Rekomendasi Pengembangan", who);
    } else {
      layak++;
      if (!snap.recommendation?.startsWith("Bidang ")) flag("Judul rekomendasi bukan bidang", who);
      if ((snap.description ?? "").split("\n\n").length !== 2) flag("Kesimpulan tidak 2 paragraf", who);
      if (!b.aspectRecommendations) flag("Rekomendasi Pengembangan tidak tersimpan", who);
    }
  }

  // Data entered/changed after the (first) finalization would not be in the raports.
  const since = new Date(oldest);
  const [scoresAfter, attAfter] = await Promise.all([
    prisma.score.count({ where: { updatedAt: { gt: since }, student: { active: true } } }),
    prisma.attendance.count({ where: { updatedAt: { gt: since }, student: { active: true } } }),
  ]);
  const nrps = new Set(students.map((s) => s.nrp));
  const ipfUnknown = [...(ipf ?? [])].filter((n) => !nrps.has(n));

  console.log("AUDIT " + JSON.stringify({
    maba: students.length, layak, tidakLayak: tidak, snapshotMabaNonaktif: inactiveSnaps,
    finalisasi: since.toISOString(), nilaiDiubahSetelahFinalisasi: scoresAfter, presensiDiubahSetelahFinalisasi: attAfter,
    ipfTidakLulus: ipf?.size ?? null, ipfNrpTidakDikenal: ipfUnknown,
    cekRaportAktif: setting(SETTING_KEYS.raportPublicCheckEnabled) ?? null,
    terimaKasihMenyebutHMD: /HMD/.test(String(setting(SETTING_KEYS.raportThankYouMessage) ?? "")),
  }));
  for (const [k, v] of Object.entries(problems)) console.log(`MASALAH ${k}: ${v.length} -> ${v.slice(0, 5).join(" | ")}`);
  if (Object.keys(problems).length === 0) console.log("MASALAH tidak ada");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
