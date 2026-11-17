"""Spreadsheet data mentah per HMD (desain formal sederhana)."""
import json, sys, statistics as st, collections as C
from openpyxl import Workbook
from openpyxl.styles import Font, Border, Side, Alignment, PatternFill
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles.differential import DifferentialStyle
from openpyxl.utils import get_column_letter

BASE, DEPT, OUTF, DATE = sys.argv[1:5]
S = json.load(open(f'{BASE}/work/stats_{DEPT}.json', encoding='utf8'))
R = json.load(open(f'{BASE}/work/rows_{DEPT}.json', encoding='utf8'))
A = json.load(open(f'{BASE}/data/all.json', encoding='utf8'))
T, SESS, KL = R['T'], R['SESS'], R['KL']
units = {u['code']: u for u in A['units']}
DN = S['deptName']
F = 'Arial'
thin = Side(style='thin', color='000000')
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
HF = Font(name=F, bold=True, size=10)
HFILL = PatternFill('solid', fgColor='D9D9D9')
BF = Font(name=F, size=10)
TF = Font(name=F, bold=True, size=12)
SF = Font(name=F, size=10)
LB = Font(name=F, bold=True, size=10)
ORG = 'BADAN EKSEKUTIF MAHASISWA FTEIC ITS'
PRED = lambda v: None if v is None else 'Sangat Baik' if v >= 85 else 'Baik' if v >= 70 else 'Cukup' if v >= 55 else 'Kurang'
STAT = {'HADIR': 'H', 'IZIN': 'I', 'ALPA': 'A', None: '-'}
SUB = [('A.1', 'Kebersamaan'), ('A.2', 'Kebanggaan Fakultas'), ('B.1', 'Manajemen Diri'), ('B.2', 'Kerja Sama'),
       ('C.1', 'Problem Solving'), ('C.2', 'Kepekaan Sosial')]
SK = [('M', 'Manajerial'), ('K', 'Keilmiahan'), ('MB', 'Minat Bakat'), ('KW', 'Kewirausahaan')]
BID = [('KW', 'Kewirausahaan', 'KW'), ('MB', 'Minat Bakat', 'MB'), ('KI', 'Keilmiahan', 'K'), ('MN', 'Manajerial', 'M')]
r2 = lambda v: None if v is None else round(float(v), 2)
fill = lambda c: PatternFill(start_color=c, end_color=c, fill_type='solid')
COLORS = {'Unggulan': 'C6EFCE', 'Berkembang': 'DDEBF7', 'Laten': 'FFF2CC', 'Pasif': 'FCE4D6', 'Rendah': 'EDEDED', 'Dikecualikan': 'D9D9D9',
          'Sangat Baik': 'C6EFCE', 'Baik': 'DDEBF7', 'Cukup': 'FFF2CC', 'Kurang': 'F8CBAD',
          'Sesuai': 'C6EFCE', 'Berbeda': 'FCE4D6', 'Tidak layak diagregasi': 'F8CBAD', 'Ya': '63BE7B', 'Perlu ditinjau': 'FFD966',
          'H': 'C6EFCE', 'I': 'FFF2CC', 'A': 'F8CBAD'}

wb = Workbook()
info = []


def header(ws, row, headers, widths):
    for j, h in enumerate(headers, 1):
        c = ws.cell(row, j, h); c.font = HF; c.fill = HFILL; c.border = BOX
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws.column_dimensions[get_column_letter(j)].width = widths[j - 1] if j - 1 < len(widths) else 12
    ws.row_dimensions[row].height = 42


def body(ws, start, rows):
    for j in range(1, max((len(r_) for r_ in rows), default=0) + 1):
        L = get_column_letter(j); w = ws.column_dimensions[L].width or 10
        m = max((len(str(r_[j - 1])) for r_ in rows if j - 1 < len(r_) and isinstance(r_[j - 1], str)), default=0)
        if m + 2 > w: ws.column_dimensions[L].width = min(m + 2, 48)
    for i, row in enumerate(rows, start):
        for j, v in enumerate(row, 1):
            c = ws.cell(i, j, v); c.font = BF; c.border = BOX
            num = isinstance(v, (int, float)) and not isinstance(v, bool)
            c.alignment = Alignment(vertical='top', horizontal='center' if num or (isinstance(v, str) and len(v) <= 3) else 'left',
                                    wrap_text=isinstance(v, str) and len(v) > 46)
            if isinstance(v, float): c.number_format = '0.00'
    return start + len(rows) - 1


def colorize(ws, rng, values):
    return  # desain sederhana: tanpa pewarnaan bersyarat


def title(ws, judul, ket=None):
    ws.cell(1, 1, ORG).font = SF
    ws.cell(2, 1, judul.upper()).font = TF
    ws.cell(3, 1, f'Departemen {DN}, data per {DATE}').font = SF
    if ket: ws.cell(4, 1, ket).font = SF


def setup(ws, hdr_row, ncol):
    ws.page_setup.orientation = 'landscape'; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = f'{hdr_row}:{hdr_row}'


def sheet(ttl, name, sub, headers, rows, widths, freeze_col=3, color_cols=(), desc=None, start=6):
    ws = wb.create_sheet(name)
    title(ws, ttl, sub)
    header(ws, start, headers, widths)
    setup(ws, start, len(headers))
    end = body(ws, start + 1, rows)
    ws.freeze_panes = ws.cell(start + 1, freeze_col + 1)
    ws.auto_filter.ref = f'A{start}:{get_column_letter(len(headers))}{max(end, start + 1)}'
    for cols, vals in color_cols:
        for col in cols:
            L = get_column_letter(col)
            colorize(ws, f'{L}{start + 1}:{L}{end}', vals)
    info.append((name, desc or title, len(rows)))
    return ws


def unit_mentor(r):
    return ((units.get(r['unitCode']) or {}).get('mentor') or {}).get('name')


# ======================= 1. PEMINATAN & POTENSI =======================
ws = wb.active; ws.title = 'Peminatan & Potensi'
title(ws, 'Data Peminatan dan Potensi Mahasiswa Baru', 'Sumber: Kuesioner 1 dan evaluasi mentor GRADAKS. Ringkasan per bidang dan keterangan istilah terdapat pada sheet Panduan.')
q1 = S['q1']
skc = {c['code']: c for c in S['skillcat']}
start = 6
H = ['No', 'NRP', 'Nama', 'Unit', 'Status Agregasi', 'Kuesioner 1 Valid'] + [f'Minat {l}' for _, l, _ in BID] + [f'Rekam Jejak {l}' for _, l, _ in BID] + \
    ['Minat Dominan'] + [f'Kuadran {l}' for _, l, _ in BID] + ['Rekomendasi Bidang', 'Kandidat Prioritas'] + \
    [f'Evaluasi Mentor {l}' for _, l, _ in BID] + ['Bidang Unggulan GRADAKS', 'Kesesuaian Kuesioner 1 dan GRADAKS', 'Tipe MBTI', 'Perlu Ditinjau']
rows = []
for i, r in enumerate(T, 1):
    q = r['_q1']; sd = {c['code']: c for c in r['skillDetail']}
    empty = any(it['origin'] == 'KOSONG' for it in r['skillItems'])
    prio = bool(q) and q['Valid Analisis'] == 1 and any((q[f'Minat {k}'] or 0) >= 3.5 and (q[f'Lv {k}'] or 0) >= 2 for k, _, _ in BID)
    gt = r['_gtop']
    gtxt = None if gt is None else ('Seimbang di semua bidang' if len(gt) == 4 else ' + '.join(gt))
    row = [i, r['nrp'], r['name'], r['unit'], 'Layak diagregasi' if r['eligible'] else 'Tidak layak diagregasi',
           ('Ya' if q['Valid Analisis'] == 1 else 'Tidak (pola seragam)') if q else 'Tidak mengisi']
    row += [r2(q[f'Minat {k}']) if q else None for k, _, _ in BID] + [int(q[f'Lv {k}'] or 0) if q else None for k, _, _ in BID]
    row += [q['Minat Dominan'] if q else None] + [q[f'Kuadran {k}'] if q else None for k, _, _ in BID]
    row += [(q['Rekomendasi Bidang'] or None) if q else None, 'Ya' if prio else None]
    row += [None if empty else r2(sd[sk]['mentorScore']) for _, _, sk in BID]
    row += [gtxt, {'Penilaian GRADAKS seimbang di semua bidang': 'Seimbang'}.get(r['_cmp'], r['_cmp']), r['_mbti'], 'Ya' if r['_crit'] else None]
    rows.append(row)
widths = [5, 13, 32, 16, 21, 12] + [12] * 8 + [24] + [12] * 4 + [26, 10] + [10] * 4 + [24, 22, 10, 10]
header(ws, start, H, widths)
setup(ws, start, len(H))
end = body(ws, start + 1, rows)
ws.freeze_panes = ws.cell(start + 1, 4)
ws.auto_filter.ref = f'A{start}:{get_column_letter(len(H))}{end}'
for col in range(16, 20): colorize(ws, f'{get_column_letter(col)}{start + 1}:{get_column_letter(col)}{end}', ['Unggulan', 'Berkembang', 'Laten', 'Pasif', 'Rendah', 'Dikecualikan'])
for col in (21, 29): colorize(ws, f'{get_column_letter(col)}{start + 1}:{get_column_letter(col)}{end}', ['Ya'])
colorize(ws, f'AA{start + 1}:AA{end}', ['Sesuai', 'Berbeda'])
colorize(ws, f'E{start + 1}:E{end}', ['Tidak layak diagregasi'])
info.append(('Peminatan & Potensi', 'Ringkasan dan daftar per Maba: minat, rekam jejak, kuadran potensi, kandidat prioritas (Kuesioner 1), evaluasi mentor per bidang, bidang unggulan GRADAKS, kesesuaian keduanya, dan MBTI', len(rows)))

# ======================= 2. NILAI MABA =======================
H = ['No', 'NRP', 'Nama', 'Kode Prodi', 'Region', 'Unit', 'Mentor', 'Status Agregasi', 'Keterangan Status',
     'Nilai Personal', 'Predikat Personal', 'Nilai Keahlian', 'Predikat Keahlian',
     'Kehadiran Temu FTEIC', 'Kehadiran Kegiatan Besar', 'Kehadiran Inclenation', 'Penilaian Materi']
H += [f'{c} {l}' for c, l in SUB]
for c, l in SK: H += [f'{l}: Nilai Bidang', f'{l}: Evaluasi Mentor', f'{l}: Komponen Kegiatan']
H += ['Penilaian Manajerial', 'Jumlah Hadir (13 Sesi)', 'Izin', 'Alpa', 'Kegiatan Keahlian Diikuti', 'Rekomendasi Raport']
rows = []
for i, r in enumerate(T, 1):
    sd = {c['code']: c for c in r['skillDetail']}
    row = [i, r['nrp'], r['name'], r['nrp'][:4], r['region'], r['unit'], unit_mentor(r),
           'Layak diagregasi' if r['eligible'] else 'Tidak layak diagregasi', '; '.join(r['reasons']) or None,
           r2(r['personal']), PRED(r['personal']), r2(r['skill']), PRED(r['skill'])]
    row += [r2(r['components'][k]) for k in ['TEMU_FTEIC', 'KEGIATAN_BESAR', 'INCLENATION', 'MATERI']]
    row += [r2(r['subNilai'][c]) for c, _ in SUB]
    for c, _ in SK: row += [r2(sd[c]['score']), r2(sd[c]['mentorScore']), r2(sd[c]['activityScore'])]
    row += [r2(sd['M']['assessmentRaw']), r['_hadir'], r['_izin'], r['_alpa'], r['keahlianAttended'],
            (r['recommendation'] or {}).get('recommendation') or 'Diteruskan ke HMD (tidak diagregasi)']
    rows.append(row)
sheet('Data Nilai Mahasiswa Baru', 'Nilai Maba', 'Seluruh nilai menggunakan skala 0-100. Predikat: Sangat Baik (85 ke atas), Baik (70-84,9), Cukup (55-69,9), Kurang (di bawah 55).', H, rows,
      [5, 13, 30, 8, 26, 16, 26, 18, 30] + [11] * (len(H) - 9),
      color_cols=[((11, 13), ['Sangat Baik', 'Baik', 'Cukup', 'Kurang']), ((8,), ['Tidak layak diagregasi'])],
      desc='Nilai Personal, Nilai Keahlian, predikat, komponen kehadiran, sub-nilai, empat bidang keahlian, dan rekap kehadiran per Maba')

# ======================= 3. PERLU DITINJAU =======================
steps = {c['name']: c['step'] for c in S['crit']}
rows = []
for r in T:
    if not r['_crit']: continue
    rows.append([r['nrp'], r['name'], r['unit'], unit_mentor(r), 'Layak' if r['eligible'] else 'Tidak layak', r2(r['personal']), r2(r['skill']),
                 r['_alpa'], len(r['_crit']), '; '.join(r['_crit']), ' | '.join(steps[c] for c in r['_crit'])])
sheet('Data Mahasiswa Baru yang Perlu Ditinjau', 'Perlu Ditinjau', 'Penandaan awal, bukan diagnosis dan bukan sanksi. Rincian catatan khusus mentor hanya dapat diperoleh melalui PSDM.',
      ['NRP', 'Nama', 'Unit', 'Mentor', 'Status Agregasi', 'Nilai Personal', 'Nilai Keahlian', 'Jumlah Alpa', 'Jumlah Kriteria', 'Kriteria', 'Langkah Awal'], rows,
      [13, 30, 16, 26, 12, 10, 10, 9, 9, 42, 70], freeze_col=2, color_cols=[((5,), [])],
      desc='Maba yang memenuhi minimal satu kriteria peninjauan beserta langkah awal yang disarankan')

# ======================= 4. KEHADIRAN =======================
H = ['No', 'NRP', 'Nama', 'Unit'] + [s['nice'] for s in SESS] + ['Hadir', 'Izin', 'Alpa'] + [f"Keahlian: {k['name']}" for k in KL]
rows = []
for i, r in enumerate(T, 1):
    rows.append([i, r['nrp'], r['name'], r['unit']] + [STAT[r['mandatorySessions'].get(s['id'])] for s in SESS] +
                [r['_hadir'], r['_izin'], r['_alpa']] + [STAT.get(r['keahlianSessions'].get(k['code'])) if r['keahlianSessions'].get(k['code']) else '-' for k in KL])
ncol = len(H)
sheet('Rekapitulasi Kehadiran per Sesi', 'Kehadiran', 'Keterangan: H = Hadir, I = Izin, A = Alpa, - = tidak tercatat. Kegiatan Keahlian bersifat pilihan.', H, rows,
      [5, 13, 30, 16] + [10] * (ncol - 4), color_cols=[(list(range(5, 5 + len(SESS))) + list(range(5 + len(SESS) + 3, ncol + 1)), ['H', 'I', 'A'])],
      desc='Status kehadiran per Maba pada 13 sesi wajib dan 6 Kegiatan Keahlian')

# ======================= 5. KUESIONER 1 (jawaban) =======================
H = ['NRP', 'Nama', 'Waktu Pengisian', 'Valid Analisis'] + [f'{k}{i}' for k, _, _ in BID for i in (1, 2, 3)] + [f'Rekam Jejak {l}' for _, l, _ in BID]
rows = []
for r in T:
    q = r['_q1']
    if not q: continue
    rows.append([r['nrp'], r['name'], str(q['Timestamp'])[:16], 'Ya' if q['Valid Analisis'] == 1 else 'Tidak'] +
                [q[f'{k}{i}'] for k, _, _ in BID for i in (1, 2, 3)] + [q[f'RJ {l}'] for _, l, _ in BID])
ws = sheet('Jawaban Kuesioner 1', 'Jawaban K1', 'Skala 1-4. KW = Kewirausahaan, MB = Minat Bakat, KI = Keilmiahan, MN = Manajerial. Teks rekam jejak sesuai isian asli.', H, rows,
           [13, 30, 16, 9] + [6] * 12 + [45] * 4, freeze_col=2, desc='Jawaban 12 butir Kuesioner 1 dan teks asli rekam jejak')
r0 = len(rows) + 7
ws.cell(r0, 1, 'Daftar butir:').font = LB
for i, x in enumerate(S['q1items'], r0 + 1):
    ws.cell(i, 1, x['code']).font = LB; ws.cell(i, 2, x['text']).font = BF

# ======================= 6. RINCIAN BUTIR =======================
ORIG = {'MENTOR': 'Mentor', 'IMPORT': 'Impor', 'KELOMPOK': 'Kelompok', 'KOSONG': 'Kosong', 'KEAKTIFAN': 'Keaktifan', 'KEHADIRAN': 'Kehadiran'}
rows = []
for r in T:
    for kind, items in (('Personal', r['personalItems']), ('Keahlian', r['skillItems'])):
        for it in items:
            rows.append([r['nrp'], r['name'], kind, it['label'], it['source'], ', '.join(it['targets']), ORIG.get(it['origin'], it['origin']), it['raw'], it['max'], r2(it['norm'])])
sheet('Rincian Nilai per Butir Penilaian', 'Rincian Butir', 'Nilai mentah yang membentuk Nilai Personal dan Nilai Keahlian.',
      ['NRP', 'Nama', 'Kelompok Nilai', 'Butir Penilaian', 'Materi / Kegiatan', 'Sub-Nilai / Bidang', 'Asal Nilai', 'Nilai Mentah', 'Skala Maksimum', 'Nilai (0-100)'], rows,
      [13, 30, 11, 46, 46, 12, 11, 10, 10, 10], freeze_col=2, desc='Log nilai mentah setiap butir penilaian beserta sumbernya')

# ======================= 7. LOGBOOK =======================
LS = {'LENGKAP': 'Lengkap', 'PERLU_REVISI': 'Perlu revisi', 'BELUM_DIVERIFIKASI': 'Belum diverifikasi'}
rows = [[r['nrp'], r['name'], r['unit'], l['periodLabel'], LS.get(l['status'], l['status'])] for r in T for l in r['logbook']]
rows += [[r['nrp'], r['name'], r['unit'], '-', 'Tidak ada logbook'] for r in T if not r['logbook']]
sheet('Status Logbook Mahasiswa Baru', 'Logbook', None, ['NRP', 'Nama', 'Unit', 'Periode', 'Status Verifikasi'], rows, [13, 30, 16, 14, 20], freeze_col=2,
      desc='Status verifikasi logbook per Maba per periode')

# ======================= 8. REKAP UNIT =======================
gu = C.defaultdict(list)
for r in T: gu[r['unitCode']].append(r)
mean = lambda v: round(st.mean(v), 2) if v else None
rows = []
for code in sorted(gu):
    rs = gu[code]; u = units.get(code, {}); m = u.get('mentor') or {}
    lay = [x for x in rs if x['eligible']]
    rows.append([code, u.get('name'), (u.get('region') or {}).get('name'), m.get('name'), len(rs), len(lay), len(rs) - len(lay),
                 mean([x['personal'] for x in lay]), mean([x['skill'] for x in lay])])
sheet('Rekapitulasi per Unit Mentoring', 'Rekap Unit', 'Rata-rata dihitung dari mahasiswa baru yang layak diagregasi.',
      ['Kode Unit', 'Unit', 'Region', 'Mentor', f'Jumlah Maba {DN}', 'Layak', 'Tidak Layak', 'Rerata Nilai Personal', 'Rerata Nilai Keahlian'], rows,
      [10, 16, 30, 30, 12, 9, 9, 12, 12], freeze_col=2, desc='Jumlah Maba, status agregasi, dan rerata nilai per unit mentoring')

# ======================= PANDUAN (first) =======================
ws = wb.create_sheet('Panduan', 0)
title(ws, 'Data Mentah Pengembangan Mahasiswa Baru', 'GRADAKS x One Data 2026. Data bersifat rahasia dan hanya digunakan untuk pembinaan di lingkungan HMD.')
ws.column_dimensions['A'].width = 30
for col, w in zip('BCDEFGHIJK', [14, 13, 13, 11, 12, 10, 10, 10, 13, 13]):
    ws.column_dimensions[col].width = w
PR = [6]
LASTCOL = 11


def sec(t):
    ws.cell(PR[0], 1, t.upper()).font = LB
    PR[0] += 1


def tbl(hdr, rows_, span_last=False):
    r = PR[0]
    for j, h in enumerate(hdr, 1):
        c = ws.cell(r, j, h); c.font = HF; c.fill = HFILL; c.border = BOX
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    if span_last:
        for j in range(len(hdr), LASTCOL + 1):
            ws.cell(r, j).border = BOX; ws.cell(r, j).fill = HFILL
        ws.merge_cells(start_row=r, start_column=len(hdr), end_row=r, end_column=LASTCOL)
    ws.row_dimensions[r].height = 42
    r += 1
    for row in rows_:
        for j, v in enumerate(row, 1):
            c = ws.cell(r, j, v); c.font = BF; c.border = BOX
            num = isinstance(v, (int, float))
            c.alignment = Alignment(vertical='top', horizontal='center' if num else 'left', wrap_text=True)
            if isinstance(v, float): c.number_format = '0.00'
        if span_last:
            for j in range(len(row), LASTCOL + 1): ws.cell(r, j).border = BOX
            ws.merge_cells(start_row=r, start_column=len(row), end_row=r, end_column=LASTCOL)
            ws.row_dimensions[r].height = 14 * (len(str(row[-1])) // 105 + 1)
        r += 1
    PR[0] = r + 1


sec('1. Ringkasan Data')
tbl(['Uraian', 'Jumlah'], [['Jumlah mahasiswa baru', S['nT']], ['Layak diagregasi', S['nTL']], ['Tidak layak diagregasi', S['nTnot']],
                           ['Responden Kuesioner 1', q1['resp']], ['Responden valid analisis', q1['valid']], ['Kandidat prioritas', S['q1prio']]])
sec('2. Ringkasan per Bidang')
BIDSK = dict((x[1], x[2]) for x in BID)
tbl(['Bidang', 'Rata-rata Minat (1-4)', 'Minat Tinggi (%)', 'Minat Dominan (%)', 'Unggulan', 'Berkembang', 'Laten', 'Pasif', 'Rendah',
     'Evaluasi Mentor (0-100)', 'Nilai Bidang (0-100)'],
    [[b['label'], round(b['t']['mean'], 2), round(b['hi'] * 100, 1), round(b['dom'] * 100, 1)] +
     [b['quad'].get(k, 0) for k in ['Unggulan', 'Berkembang', 'Laten', 'Pasif', 'Rendah']] +
     [round(skc[BIDSK[b['label']]]['mentor']['mean'], 2), round(skc[BIDSK[b['label']]]['t']['mean'], 2)] for b in S['q1b']])
ws.cell(PR[0] - 1, 1, 'Kolom Unggulan sampai Rendah berisi jumlah mahasiswa baru pada setiap kuadran potensi Kuesioner 1.').font = SF
PR[0] += 1
sec('3. Daftar Sheet')
tbl(['Sheet', 'Isi'], [[n_, f'{d_} ({cnt} baris)'] for n_, d_, cnt in info], span_last=True)
sec('4. Keterangan Istilah')
defs = [('Nilai Personal', '25% Kehadiran Temu FTEIC + 25% Kehadiran Kegiatan Besar + 10% Kehadiran Inclenation + 40% Penilaian Materi.'),
        ('Penilaian Materi', 'Rata-rata tertimbang enam sub-nilai dengan bobot AHP: A.1 2,00%; A.2 37,87%; B.1 26,09%; B.2 17,55%; C.1 11,72%; C.2 4,76%.'),
        ('Nilai Keahlian', 'Rata-rata empat bidang. Setiap bidang terdiri atas 80% evaluasi mentor dan 20% komponen kegiatan (Manajerial: Penilaian Manajerial; bidang lain: bernilai 100 apabila mengikuti minimal satu Kegiatan Keahlian pada bidang tersebut).'),
        ('Skor kehadiran', 'Hadir = 100, Izin = 50, Alpa = 0, dirata-rata dari sesi yang terlaksana.'),
        ('Layak diagregasi', 'Alpa Temu FTEIC paling banyak 2 kali dan alpa Kegiatan Besar paling banyak 3 kali. Izin tidak dihitung sebagai alpa.'),
        ('Predikat', 'Sangat Baik (85 ke atas), Baik (70-84,9), Cukup (55-69,9), Kurang (di bawah 55).'),
        ('Skor minat', 'Rata-rata tiga butir Kuesioner 1 per bidang pada skala 1-4. Minat tinggi apabila skor 3,00 ke atas.'),
        ('Rekam jejak', 'Level 0 = belum ada pengalaman; 1 = pernah terlibat; 2 = berprestasi atau peran inti; 3 = prestasi atau peran puncak tingkat tinggi.'),
        ('Kuadran Unggulan', 'Minat tinggi dan rekam jejak kuat (level 2 ke atas).'),
        ('Kuadran Berkembang', 'Minat tinggi dan rekam jejak awal (level 1).'),
        ('Kuadran Laten', 'Minat tinggi, belum memiliki rekam jejak.'),
        ('Kuadran Pasif', 'Minat rendah, memiliki rekam jejak.'),
        ('Kuadran Rendah', 'Minat rendah, belum memiliki rekam jejak.'),
        ('Kandidat prioritas', 'Skor minat 3,50 ke atas dan rekam jejak level 2 ke atas pada bidang yang sama.'),
        ('Bidang unggulan GRADAKS', 'Bidang dengan evaluasi mentor tertinggi. Seimbang apabila mentor memberi nilai yang sama pada keempat bidang.'),
        ('Kesesuaian Kuesioner 1 dan GRADAKS', 'Sesuai apabila bidang minat dominan sama dengan bidang unggulan GRADAKS; Berbeda apabila tidak ada yang sama.')]
tbl(['Istilah', 'Pengertian'], [list(x) for x in defs], span_last=True)
ws.page_setup.orientation = 'landscape'; ws.sheet_properties.pageSetUpPr.fitToPage = True; ws.page_setup.fitToHeight = 0

wb.save(OUTF)
json.dump([['Panduan', 'Panduan sheet dan ketentuan perhitungan', None]] + [list(x) for x in info], open(f'{BASE}/work/sheets_{DEPT}.json', 'w', encoding='utf8'), ensure_ascii=False)
print('xlsx ok', OUTF)
