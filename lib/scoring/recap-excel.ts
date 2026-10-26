import "server-only";
import ExcelJS from "exceljs";
import {
  buildRecapStats,
  buildDepartmentStats,
  recapExplanations,
  SUB_NILAI_LABELS,
  SKILL_LABELS,
  type RecapData,
  type RecapRow,
} from "./recap";

/** Same formula-injection guard as the main export (names come from CSV imports). */
function sanitizeCell<T>(value: T): T {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) return `'${value}` as T;
  return value;
}

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
}

/** In-cell bar chart (Excel data bar) over a numeric column range. */
function addDataBar(ws: ExcelJS.Worksheet, ref: string, argb: string) {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "dataBar",
        priority: 1,
        gradient: false,
        cfvo: [
          { type: "num", value: 0 },
          { type: "max" },
        ],
        color: { argb },
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });
}

/**
 * Writes one chart's data as a titled table with its explanation underneath
 * the title and Excel data bars on the value columns — a chart readers can
 * see straight away, plus the raw numbers to rebuild it as a native chart.
 */
function addChartTable(
  ws: ExcelJS.Worksheet,
  title: string,
  explanation: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
  barColumns: number[],
) {
  const titleRow = ws.addRow([title]);
  titleRow.font = { bold: true, size: 12 };
  const expRow = ws.addRow([explanation]);
  ws.mergeCells(expRow.number, 1, expRow.number, 6);
  expRow.getCell(1).alignment = { wrapText: true, vertical: "top" };
  expRow.height = Math.max(30, Math.ceil(explanation.length / 90) * 15);
  expRow.font = { italic: true, color: { argb: "FF6B7280" } };
  styleHeader(ws.addRow(headers));
  const first = ws.rowCount + 1;
  for (const r of rows) ws.addRow(r.map((v) => (v === null ? "-" : v)));
  const last = ws.rowCount;
  for (const col of barColumns) {
    const letter = ws.getColumn(col).letter;
    if (last >= first) addDataBar(ws, `${letter}${first}:${letter}${last}`, col % 2 ? "FF2A78D6" : "FF1BAF7A");
  }
  ws.addRow([]);
}

function addDataSheet(workbook: ExcelJS.Workbook, name: string, rows: RecapRow[]) {
  const ws = workbook.addWorksheet(name);
  const subCodes = Object.keys(SUB_NILAI_LABELS);
  const skillCodes = Object.keys(SKILL_LABELS);
  ws.columns = [
    { header: "NRP", key: "nrp", width: 13 },
    { header: "Nama", key: "name", width: 28 },
    { header: "Departemen", key: "dept", width: 22 },
    { header: "Region", key: "region", width: 18 },
    { header: "Unit", key: "unit", width: 18 },
    { header: "Status", key: "status", width: 16 },
    { header: "Alasan Tidak Layak", key: "reasons", width: 36 },
    { header: "Nilai Personal", key: "personal", width: 10 },
    { header: "Nilai Keahlian", key: "skill", width: 10 },
    { header: "Kehadiran Temu FTEIC", key: "temu", width: 11 },
    { header: "Kehadiran Kegiatan Besar", key: "besar", width: 11 },
    { header: "Kehadiran Inclenation", key: "incl", width: 11 },
    { header: "Penilaian Materi", key: "materi", width: 10 },
    ...subCodes.map((c) => ({ header: `${c} ${SUB_NILAI_LABELS[c]}`, key: `sub_${c}`, width: 11 })),
    ...skillCodes.flatMap((c) => [
      { header: `${SKILL_LABELS[c]}`, key: `sk_${c}`, width: 11 },
      { header: `${SKILL_LABELS[c]} — mentor`, key: `skm_${c}`, width: 11 },
      { header: `${SKILL_LABELS[c]} — kegiatan`, key: `skk_${c}`, width: 11 },
    ]),
    { header: "Hadir Temu FTEIC", key: "hTemu", width: 10 },
    { header: "Hadir Kegiatan Besar", key: "hBesar", width: 10 },
    { header: "Hadir Inclenation", key: "hIncl", width: 10 },
    { header: "Kegiatan Keahlian diikuti", key: "hKeahlian", width: 10 },
  ];
  styleHeader(ws.getRow(1));
  ws.getRow(1).alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(1).height = 45;
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  const n = (v: number | null) => (v === null ? null : Number(v.toFixed(2)));
  const att = (a: { attended: number; held: number }) => `${a.attended}/${a.held}`;
  for (const r of rows) {
    ws.addRow({
      nrp: sanitizeCell(r.nrp),
      name: sanitizeCell(r.name),
      dept: sanitizeCell(r.departmentName),
      region: sanitizeCell(r.region),
      unit: sanitizeCell(r.unit),
      status: r.eligible ? "Layak" : "Tidak layak diagregasi",
      reasons: r.reasons.join("; "),
      personal: n(r.personal),
      skill: n(r.skill),
      temu: n(r.components.TEMU_FTEIC),
      besar: n(r.components.KEGIATAN_BESAR),
      incl: n(r.components.INCLENATION),
      materi: n(r.components.MATERI),
      ...Object.fromEntries(subCodes.map((c) => [`sub_${c}`, n(r.subNilai[c] ?? null)])),
      ...Object.fromEntries(
        skillCodes.flatMap((c) => [
          [`sk_${c}`, n(r.skillCategories[c]?.score ?? null)],
          [`skm_${c}`, n(r.skillCategories[c]?.mentor ?? null)],
          [`skk_${c}`, n(r.skillCategories[c]?.kegiatan ?? null)],
        ]),
      ),
      hTemu: att(r.attendance.TEMU_FTEIC),
      hBesar: att(r.attendance.KEGIATAN_BESAR),
      hIncl: att(r.attendance.INCLENATION),
      hKeahlian: r.keahlianAttended,
    });
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

/**
 * The recap as an Excel workbook — Penjelasan, Ringkasan & Grafik (data bars),
 * per-maba data and the tidak-layak list — for the whole cohort or one
 * department (deptCode). Pure over RecapData so it can be tested offline.
 */
export function buildRecapWorkbook(data: RecapData, dept: string | null): { workbook: ExcelJS.Workbook; slug: string } {
  const { rows, meta } = data;
  const departments = buildDepartmentStats(rows);
  const activeDept = departments.find((d) => d.code === dept) ?? null;
  const scoped = activeDept ? rows.filter((r) => r.departmentCode === activeDept.code) : rows;
  const stats = buildRecapStats(scoped);
  const exp = recapExplanations(meta);
  const scopeName = activeDept ? activeDept.name : "Seluruh Departemen";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Portal Pengembangan MABA 26 — PSDM BEM FTEIC";
  workbook.created = new Date();

  // ---- Sheet 1: Penjelasan ----
  const info = workbook.addWorksheet("Penjelasan");
  info.getColumn(1).width = 28;
  info.getColumn(2).width = 110;
  info.addRow([`Rekap Nilai Maba GRADAKS 2026 — ${scopeName}`]).font = { bold: true, size: 14 };
  info.addRow(["Dihitung", new Date(meta.generatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })]);
  info.addRow(["Jumlah maba", stats.total]);
  info.addRow(["Layak diagregasi", stats.eligible]);
  info.addRow(["Tidak layak diagregasi", `${stats.ineligible} (Temu FTEIC ${stats.ineligibleTemu}, Kegiatan Besar ${stats.ineligibleBesar})`]);
  info.addRow([]);
  info.addRow(["Dari mana nilai berasal"]).font = { bold: true, size: 12 };
  exp.overview.forEach((line, i) => {
    const row = info.addRow([`${i + 1}.`, line]);
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  });
  info.addRow([]);
  info.addRow(["Penjelasan grafik (sheet Ringkasan & Grafik)"]).font = { bold: true, size: 12 };
  const chartNotes: Array<[string, string]> = [
    ["Sebaran Nilai Personal", exp.personalHist],
    ["Sebaran Nilai Keahlian", exp.skillHist],
    ["Komponen Nilai Personal", exp.components],
    ["Sub-Nilai Penilaian Materi", exp.subNilai],
    ["Kategori Nilai Keahlian", exp.skillCategories],
    ["Kehadiran Kegiatan Wajib", exp.attendance],
    ...(activeDept ? [] : ([["Perbandingan Departemen", exp.departments]] as Array<[string, string]>)),
  ];
  for (const [title, text] of chartNotes) {
    const row = info.addRow([title, text]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }
  info.addRow([]);
  info.addRow([
    "Catatan",
    "Grafik di sheet Ringkasan & Grafik ditampilkan sebagai batang data (data bar) di dalam sel. Tabel angkanya bisa langsung diblok lalu Insert → Chart bila ingin grafik Excel biasa.",
  ]).getCell(2).alignment = { wrapText: true };

  // ---- Sheet 2: Ringkasan & Grafik ----
  const sum = workbook.addWorksheet("Ringkasan & Grafik");
  sum.getColumn(1).width = 30;
  for (let c = 2; c <= 6; c++) sum.getColumn(c).width = 16;
  addChartTable(
    sum,
    "Statistik Nilai (maba layak diagregasi)",
    "n = jumlah maba layak; SD = simpangan baku (makin besar = makin beragam).",
    ["Nilai", "n", "Rata-rata", "Median", "Min", "Maks"],
    [
      ["Nilai Personal", stats.personal.n, stats.personal.mean, stats.personal.median, stats.personal.min, stats.personal.max],
      ["Nilai Keahlian", stats.skill.n, stats.skill.mean, stats.skill.median, stats.skill.min, stats.skill.max],
    ],
    [],
  );
  addChartTable(sum, "Sebaran Nilai Personal", exp.personalHist, ["Rentang nilai", "Layak", "Tidak layak"], stats.personalHist.map((b) => [b.bin, b.layak, b.tidakLayak]), [2, 3]);
  addChartTable(sum, "Sebaran Nilai Keahlian", exp.skillHist, ["Rentang nilai", "Layak", "Tidak layak"], stats.skillHist.map((b) => [b.bin, b.layak, b.tidakLayak]), [2, 3]);
  addChartTable(sum, "Komponen Nilai Personal", exp.components, ["Komponen", "Rata-rata"], stats.components.map((c) => [c.label, c.mean]), [2]);
  addChartTable(sum, "Sub-Nilai Penilaian Materi", exp.subNilai, ["Sub-Nilai", "Rata-rata"], stats.subNilai.map((c) => [c.label, c.mean]), [2]);
  addChartTable(
    sum,
    "Kategori Nilai Keahlian",
    exp.skillCategories,
    ["Kategori", "Nilai kategori", "Evaluasi mentor", "% ikut kegiatan"],
    stats.skillCategories.map((c) => [c.label, c.mean, c.mentorMean, c.participationPct]),
    [2, 3, 4],
  );
  addChartTable(sum, "Kehadiran Kegiatan Wajib", exp.attendance, ["Kegiatan", "% Hadir", "Sesi terlaksana"], stats.attendance.map((a) => [a.label, a.hadirPct, a.heldSessions]), [2]);
  if (!activeDept) {
    addChartTable(
      sum,
      "Perbandingan Antar Departemen",
      exp.departments,
      ["Departemen", "Maba", "Layak", "Tidak layak", "Rata-rata Personal", "Rata-rata Keahlian"],
      departments.map((d) => [d.name, d.total, d.eligible, d.total - d.eligible, d.personalMean, d.skillMean]),
      [5, 6],
    );
  }

  // ---- Sheet 3+: data per maba ----
  addDataSheet(workbook, "Data Maba", scoped);
  const ineligible = scoped.filter((r) => !r.eligible);
  if (ineligible.length > 0) addDataSheet(workbook, "Tidak Layak Diagregasi", ineligible);

  const slug = (activeDept?.code ?? "SEMUA").replace(/[^A-Za-z0-9_-]/g, "");
  return { workbook, slug };
}
