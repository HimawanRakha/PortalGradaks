import "server-only";
import { Document, Font, Image, Page, StyleSheet, Text, View, type Styles } from "@react-pdf/renderer";
import type { ComputedScores } from "@/lib/scoring/calculate";
import { predicateOf, type PredicateThresholds } from "@/lib/scoring/recap";

export type RaportPdfProps = {
  student: { name: string; nrp: string; department: string; unit: string; region: string };
  computed: ComputedScores;
  /** null = not finalized yet: values are a running estimate. */
  final: { recommendation: string | null; description: string | null; dataInsufficient: boolean; finalizedAt: Date } | null;
  thankYouMessage: string;
  thresholds: PredicateThresholds;
  logo: Buffer | null;
  generatedAt: Date;
};

/**
 * The built-in PDF fonts only cover Latin-1, so anything else (emoji, ≥, →,
 * curly quotes from pasted rule texts) is mapped or dropped instead of
 * rendering as garbage.
 */
function pdfText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

// Indonesian text gets mangled by the default English hyphenation ("bertum-buh"): wrap on whole words only.
Font.registerHyphenationCallback((word) => [word]);

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 3).trimEnd()}...` : s);
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "-" : v.toFixed(1));
const dateId = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

const C = { ink: "#111827", muted: "#6B7280", line: "#D1D5DB", head: "#1F2937", soft: "#F3F4F6", accent: "#1D4ED8" };

const s = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 36, paddingHorizontal: 42, fontSize: 9.5, fontFamily: "Helvetica", color: C.ink, lineHeight: 1.35 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: C.head },
  logo: { width: 50, height: 50 },
  org: { fontSize: 9, color: C.muted, lineHeight: 1.2 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginTop: 3 },
  subtitle: { fontSize: 9.5, color: C.muted, lineHeight: 1.2, marginTop: 3 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 5, color: C.head },
  identity: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  idCell: { width: "50%", flexDirection: "row", marginBottom: 3, paddingRight: 6 },
  idLabel: { width: 72, color: C.muted },
  idValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  scoreRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  scoreBox: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 5, paddingVertical: 8, alignItems: "center" },
  scoreLabel: { fontSize: 9, color: C.muted, lineHeight: 1.2, letterSpacing: 0.5 },
  scoreValue: { fontSize: 24, fontFamily: "Helvetica-Bold", lineHeight: 1.15, marginTop: 4 },
  scorePred: { fontSize: 10, color: C.accent, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginTop: 4 },
  columns: { flexDirection: "row", gap: 14 },
  col: { flex: 1 },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 3, paddingHorizontal: 6 },
  trLast: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6 },
  th: { backgroundColor: C.soft, fontFamily: "Helvetica-Bold" },
  tdLabel: { flex: 1 },
  tdNum: { width: 42, textAlign: "right" },
  tdWide: { width: 64, textAlign: "right" },
  status: { marginTop: 12, borderWidth: 1.2, borderRadius: 5, padding: 9 },
  statusTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  closing: { marginTop: 12 },
  sign: { marginTop: 16, alignItems: "flex-end" },
  footer: { position: "absolute", bottom: 18, left: 44, right: 44, fontSize: 7, color: C.muted, textAlign: "center", lineHeight: 1.3 },
});

function Row({ cells, header, last }: { cells: Array<{ text: string; style: Styles[string] }>; header?: boolean; last?: boolean }) {
  return (
    <View style={[last ? s.trLast : s.tr, header ? s.th : {}]}>
      {cells.map((c, i) => (
        <Text key={i} style={c.style}>
          {c.text}
        </Text>
      ))}
    </View>
  );
}

export function RaportPdf({ student, computed, final, thankYouMessage, thresholds, logo, generatedAt }: RaportPdfProps) {
  const pred = (v: number | null) => (v === null ? "" : predicateOf(v, thresholds));
  const subNilai = computed.personal.groups.flatMap((g) => g.subNilai.map((x) => ({ ...x, label: x.label.replace(/\s*\(.*\)$/, "") })));
  const sections = computed.attendance;

  let statusTitle: string;
  let statusBody: string;
  let statusColor: string;
  if (!final && !computed.eligibility.eligible) {
    statusTitle = "Status: Belum Difinalisasi - Terindikasi Tidak Layak Diagregasi";
    statusBody = `${pdfText(computed.eligibility.reasons.join("; "))}. Bila hingga finalisasi tetap demikian, data Anda tidak masuk pengolahan dan diserahkan ke HMD untuk pendampingan lebih lanjut.`;
    statusColor = "#B45309";
  } else if (!final) {
    statusTitle = "Status: Belum Difinalisasi (Nilai Sementara)";
    statusBody = "Nilai pada dokumen ini masih estimasi berjalan. Keputusan rekomendasi resmi akan tersedia setelah PSDM BEM FTEIC melakukan finalisasi raport.";
    statusColor = C.muted;
  } else if (final.dataInsufficient) {
    statusTitle = `Keputusan: ${pdfText(final.recommendation) || "Tidak Dapat Diagregasi"}`;
    statusBody = pdfText(final.description);
    statusColor = "#B45309";
  } else {
    statusTitle = `Rekomendasi: ${pdfText(final.recommendation) || "-"}`;
    statusBody = pdfText(final.description);
    statusColor = "#047857";
  }

  return (
    <Document title={`Raport GRADAKS 2026 - ${pdfText(student.name)}`} author="PSDM BEM FTEIC" creator="Portal Gradaks">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {logo ? <Image src={{ data: logo, format: "png" }} style={s.logo} /> : null}
          <View>
            <Text style={s.org}>DEPARTEMEN PSDM BEM FTEIC ITS</Text>
            <Text style={s.title}>RAPORT PENGEMBANGAN MAHASISWA BARU</Text>
            <Text style={s.subtitle}>GRADAKS 2026{final ? ` - Final per ${dateId(final.finalizedAt)}` : " - Nilai Sementara"}</Text>
          </View>
        </View>

        <View style={s.identity}>
          <View style={s.idCell}>
            <Text style={s.idLabel}>Nama</Text>
            <Text style={s.idValue}>{pdfText(student.name)}</Text>
          </View>
          <View style={s.idCell}>
            <Text style={s.idLabel}>Departemen</Text>
            <Text style={s.idValue}>{pdfText(student.department)}</Text>
          </View>
          <View style={s.idCell}>
            <Text style={s.idLabel}>NRP</Text>
            <Text style={s.idValue}>{pdfText(student.nrp)}</Text>
          </View>
          <View style={s.idCell}>
            <Text style={s.idLabel}>Unit / Region</Text>
            <Text style={s.idValue}>{pdfText(`${student.unit} / ${student.region}`)}</Text>
          </View>
        </View>

        <View style={s.scoreRow}>
          <View style={s.scoreBox}>
            <Text style={s.scoreLabel}>NILAI PERSONAL</Text>
            <Text style={s.scoreValue}>{fmt(computed.personal.score)}</Text>
            <Text style={s.scorePred}>{pred(computed.personal.score)}</Text>
          </View>
          <View style={s.scoreBox}>
            <Text style={s.scoreLabel}>NILAI KEAHLIAN</Text>
            <Text style={s.scoreValue}>{fmt(computed.skill.score)}</Text>
            <Text style={s.scorePred}>{pred(computed.skill.score)}</Text>
          </View>
        </View>

        <View style={[s.section, s.columns]}>
          <View style={s.col}>
            <Text style={s.sectionTitle}>Komponen Nilai Personal</Text>
            <View style={s.table}>
              <Row header cells={[{ text: "Komponen", style: s.tdLabel }, { text: "Bobot", style: s.tdNum }, { text: "Nilai", style: s.tdNum }]} />
              {computed.personal.components.map((c, i, arr) => (
                <Row
                  key={c.code}
                  last={i === arr.length - 1}
                  cells={[
                    { text: c.label, style: s.tdLabel },
                    { text: c.score === null ? "-" : `${Math.round(c.effectiveWeight * 100)}%`, style: s.tdNum },
                    { text: fmt(c.score), style: s.tdNum },
                  ]}
                />
              ))}
            </View>

            <Text style={[s.sectionTitle, { marginTop: 10 }]}>Kehadiran</Text>
            <View style={s.table}>
              <Row header cells={[{ text: "Kegiatan", style: s.tdLabel }, { text: "Hadir", style: s.tdWide }]} />
              {sections.map((sec, i, arr) => (
                <Row
                  key={sec.category}
                  last={i === arr.length - 1}
                  cells={[
                    { text: sec.label, style: s.tdLabel },
                    {
                      text: sec.category === "KEAHLIAN" ? `${sec.attendedCount} kegiatan` : `${sec.attendedCount} / ${sec.heldCount} sesi`,
                      style: s.tdWide,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={s.col}>
            <Text style={s.sectionTitle}>Sub-Nilai Penilaian Materi</Text>
            <View style={s.table}>
              <Row header cells={[{ text: "Sub-Nilai", style: s.tdLabel }, { text: "Nilai", style: s.tdNum }, { text: "Predikat", style: s.tdWide }]} />
              {subNilai.map((x, i, arr) => (
                <Row
                  key={x.code}
                  last={i === arr.length - 1}
                  cells={[
                    { text: `${x.code} ${x.label}`, style: s.tdLabel },
                    { text: fmt(x.score), style: s.tdNum },
                    { text: pred(x.score), style: s.tdWide },
                  ]}
                />
              ))}
            </View>

            <Text style={[s.sectionTitle, { marginTop: 10 }]}>Nilai Keahlian per Kategori</Text>
            <View style={s.table}>
              <Row header cells={[{ text: "Kategori", style: s.tdLabel }, { text: "Nilai", style: s.tdNum }, { text: "Predikat", style: s.tdWide }]} />
              {computed.skill.categories.map((c, i, arr) => (
                <Row
                  key={c.code}
                  last={i === arr.length - 1}
                  cells={[
                    { text: c.label, style: s.tdLabel },
                    { text: fmt(c.score), style: s.tdNum },
                    { text: pred(c.score), style: s.tdWide },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={[s.status, { borderColor: statusColor }]}>
          <Text style={[s.statusTitle, { color: statusColor }]}>{statusTitle}</Text>
          {statusBody ? <Text>{clip(statusBody, 600)}</Text> : null}
        </View>

        <Text style={s.closing}>{clip(pdfText(thankYouMessage), 700)}</Text>

        <View style={s.sign}>
          <Text>Surabaya, {dateId(final?.finalizedAt ?? generatedAt)}</Text>
          <Text style={{ marginTop: 2, fontFamily: "Helvetica-Bold" }}>Departemen PSDM BEM FTEIC ITS</Text>
        </View>

        <Text style={s.footer} fixed>
          Dokumen ini dihasilkan otomatis oleh Portal Gradaks pada {dateId(generatedAt)}. Nilai dalam skala 0-100; predikat: Sangat Baik
          {" >= "}
          {thresholds.sangatBaik}, Baik {">= "}
          {thresholds.baik}, Cukup {">= "}
          {thresholds.cukup}, selain itu Kurang.
        </Text>
      </Page>
    </Document>
  );
}
