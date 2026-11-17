"""Kelulusan IPF (Inclenation) hasil cek ulang dengan aturan final dan nilai database terbaru."""
import json, sys, collections as C
from openpyxl import Workbook
from openpyxl.styles import Font, Border, Side, Alignment, PatternFill
from openpyxl.utils import get_column_letter

OUT = sys.argv[1]
NP_MIN, TEMU_ALPA_MAX = 55, 2
F = json.load(open('work/ipf_F.json', encoding='utf8'))['F']
d = json.load(open('data/now.json', encoding='utf8')); D = {r['nrp']: r for r in d['rows']}
A = 'Arial'
thin = Side(style='thin', color='000000'); BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
HF = Font(name=A, bold=True, size=10); HFILL = PatternFill('solid', fgColor='D9D9D9'); BF = Font(name=A, size=10)


def sec(r, c): return [e['status'] for e in next(s for s in r['attendanceDetail'] if s['category'] == c)['entries']]


def decide(r):
    ic = sec(r, 'INCLENATION'); tm = sec(r, 'TEMU_FTEIC'); np_ = r['personal'] or 0
    h, i, a = ic.count('HADIR'), ic.count('IZIN'), ic.count('ALPA')
    ta = tm.count('ALPA')
    if h == 2: return 'LULUS', 'Aturan 1: hadir 2 hari Inclenation'
    if ta <= TEMU_ALPA_MAX:
        return 'LULUS', ('Aturan 3' if h == 1 else 'Aturan 2') + f': mengikuti Temu FTEIC (hadir {tm.count("HADIR")}, izin {tm.count("IZIN")}, alpa {ta})'
    return 'TIDAK LULUS', f'Alpa Temu FTEIC {ta} kali dari 5 sesi (maksimal {TEMU_ALPA_MAX})'


rows = []
for n, f in F.items():
    r = D[n]; ic = sec(r, 'INCLENATION'); tm = sec(r, 'TEMU_FTEIC')
    kat, dasar = decide(r)
    lama = 'TIDAK LULUS' if f['kat'] == 'TIDAK LULUS' else 'LULUS'
    rows.append(dict(nrp=n, nama=f['nama'], dept=f['dept'], region=f['region'], unit=f['unit'],
                     agr='Layak' if r['eligible'] else 'Tidak layak diagregasi',
                     ih=ic.count('HADIR'), ii=ic.count('IZIN'), ia=ic.count('ALPA'),
                     th=tm.count('HADIR'), ti=tm.count('IZIN'), ta=tm.count('ALPA'),
                     np=round(r['personal'] or 0, 2), kat=kat, dasar=dasar, lama=f['kat'], ubah=kat != lama))
rows.sort(key=lambda x: (x['dept'], x['nrp']))

HDR = ['No', 'NRP', 'Nama', 'Departemen', 'Region', 'Unit', 'Status Agregasi', 'Inclenation Hadir', 'Inclenation Izin', 'Inclenation Alpa',
       'Temu FTEIC Hadir', 'Temu FTEIC Izin', 'Temu FTEIC Alpa', 'Nilai Personal', 'Kategori', 'Dasar Keputusan']
WID = [5, 13, 32, 18, 30, 14, 20, 10, 10, 10, 10, 10, 10, 10, 13, 58]


def line(i, x): return [i, x['nrp'], x['nama'], x['dept'], x['region'], x['unit'], x['agr'], x['ih'], x['ii'], x['ia'], x['th'], x['ti'], x['ta'], x['np'], x['kat'], x['dasar']]


def sheet(wb, name, title, ket, hdr, data, wid, first=False):
    ws = wb.active if first else wb.create_sheet(name); ws.title = name
    ws.cell(1, 1, 'BADAN EKSEKUTIF MAHASISWA FTEIC ITS').font = BF
    ws.cell(2, 1, title.upper()).font = Font(name=A, bold=True, size=12)
    ws.cell(3, 1, 'Data kehadiran dan nilai dari Portal GRADAKS per 17 November 2026').font = BF
    if ket: ws.cell(4, 1, ket).font = BF
    for j, (h, w) in enumerate(zip(hdr, wid), 1):
        c = ws.cell(6, j, h); c.font = HF; c.fill = HFILL; c.border = BOX
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws.column_dimensions[get_column_letter(j)].width = w
    ws.row_dimensions[6].height = 42
    for i, row in enumerate(data, 7):
        for j, v in enumerate(row, 1):
            c = ws.cell(i, j, v); c.font = BF; c.border = BOX
            num = isinstance(v, (int, float))
            c.alignment = Alignment(vertical='top', horizontal='center' if num else 'left')
            if isinstance(v, float): c.number_format = '0.00'
    if data:
        ws.freeze_panes = 'D7'; ws.auto_filter.ref = f'A6:{get_column_letter(len(hdr))}{6 + len(data)}'
    ws.page_setup.orientation = 'landscape'; ws.sheet_properties.pageSetUpPr.fitToPage = True; ws.page_setup.fitToHeight = 0
    return ws


wb = Workbook()
ws = sheet(wb, 'Aturan', 'Aturan Kelulusan IPF (Inclenation) GRADAKS 2026', None, ['No', 'Kondisi Inclenation', 'Syarat', 'Hasil'],
           [[1, 'Hadir 2 hari', '-', 'LULUS'],
            [2, 'Tidak hadir 2 hari (izin atau alpa)', f'Tetap mengikuti Temu FTEIC: alpa paling banyak {TEMU_ALPA_MAX} kali dari 5 sesi', 'LULUS'],
            [3, 'Hadir 1 hari (hari lainnya izin atau alpa)', f'Tetap mengikuti Temu FTEIC: alpa paling banyak {TEMU_ALPA_MAX} kali dari 5 sesi', 'LULUS'],
            [4, 'Tidak memenuhi aturan 1 sampai 3', '-', 'TIDAK LULUS']], [5, 40, 70, 14], first=True)
cnt = C.Counter(x['kat'] for x in rows)
r0 = 13
for i, (a, b) in enumerate([('Jumlah Maba', len(rows)), ('Lulus', cnt['LULUS']), ('Tidak Lulus', cnt['TIDAK LULUS']),
                            ('Berubah dari berkas sebelumnya', sum(x['ubah'] for x in rows))], r0):
    ws.cell(i, 2, a).font = HF; ws.cell(i, 3, b).font = BF
    ws.cell(i, 2).border = BOX; ws.cell(i, 3).border = BOX; ws.cell(i, 3).alignment = Alignment(horizontal='left')
ws.cell(r0 + 5, 2, 'Keterangan: izin tidak dihitung sebagai alpa. Nilai Personal = 25% Kehadiran Temu FTEIC + 25% Kehadiran Kegiatan Besar + 10% Kehadiran Inclenation + 40% Penilaian Materi.').font = BF
ws.cell(r0 + 6, 2, 'Nilai tidak dijadikan syarat karena Maba yang tidak mengikuti Inclenation otomatis kehilangan butir penilaian materi Inclenation. Nilai Personal dicantumkan sebagai informasi.').font = BF

ch = [x for x in rows if x['ubah']]
sheet(wb, 'Perubahan', 'Daftar Maba yang Berubah Status', 'Dibandingkan dengan berkas kelulusan_inclenation_GRADAKS_2026_FINAL.xlsx.',
      ['No', 'NRP', 'Nama', 'Departemen', 'Kategori di Berkas Lama', 'Kategori Baru', 'Inclenation (H/I/A)', 'Temu FTEIC (H/I/A)', 'Nilai Personal', 'Dasar Keputusan'],
      [[i, x['nrp'], x['nama'], x['dept'], x['lama'], x['kat'], f"{x['ih']}/{x['ii']}/{x['ia']}", f"{x['th']}/{x['ti']}/{x['ta']}", x['np'], x['dasar']] for i, x in enumerate(ch, 1)],
      [5, 13, 32, 18, 20, 14, 14, 14, 10, 58])
sheet(wb, 'LULUS', 'Daftar Maba Lulus IPF', None, HDR, [line(i, x) for i, x in enumerate([x for x in rows if x['kat'] == 'LULUS'], 1)], WID)
sheet(wb, 'TIDAK LULUS', 'Daftar Maba Tidak Lulus IPF', None, HDR, [line(i, x) for i, x in enumerate([x for x in rows if x['kat'] == 'TIDAK LULUS'], 1)], WID)
dep = C.defaultdict(C.Counter)
for x in rows: dep[x['dept']][x['kat']] += 1
sheet(wb, 'Rekap Departemen', 'Rekapitulasi Kelulusan per Departemen', None, ['Departemen', 'Jumlah Maba', 'Lulus', 'Tidak Lulus'],
      [[k, sum(v.values()), v['LULUS'], v['TIDAK LULUS']] for k, v in sorted(dep.items())] +
      [['Jumlah', len(rows), cnt['LULUS'], cnt['TIDAK LULUS']]], [24, 12, 12, 12])
wb.save(OUT)
json.dump(rows, open('work/kelulusan_final.json', 'w', encoding='utf8'), ensure_ascii=False)
print('ok', dict(cnt), 'berubah', len(ch))
for x in ch: print(' ', x['nrp'], x['nama'], x['dept'], x['lama'], '->', x['kat'], '|', x['dasar'])
for k, v in sorted(dep.items()): print(' ', k, dict(v))
