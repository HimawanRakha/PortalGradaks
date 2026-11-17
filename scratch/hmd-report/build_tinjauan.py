"""Tinjauan berkas kelulusan IPF terhadap database Portal GRADAKS (desain formal)."""
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, Border, Side, Alignment, PatternFill
from openpyxl.utils import get_column_letter

OUT = sys.argv[1]
rows = {r['nrp']: r for r in json.load(open('work/ipf_rows.json', encoding='utf8'))}
F = json.load(open('work/ipf_F.json', encoding='utf8'))['F']
d = json.load(open('data/now.json', encoding='utf8')); D = {r['nrp']: r for r in d['rows']}
A = 'Arial'
thin = Side(style='thin', color='000000'); BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
HF = Font(name=A, bold=True, size=10); HFILL = PatternFill('solid', fgColor='D9D9D9'); BF = Font(name=A, size=10)


def kosong(r): return any(i['origin'] == 'KOSONG' for i in r['skillItems'])


def sheet(wb, name, title, ket, hdr, data, widths, first=False):
    ws = wb.active if first else wb.create_sheet(name)
    ws.title = name
    ws.cell(1, 1, 'BADAN EKSEKUTIF MAHASISWA FTEIC ITS').font = BF
    ws.cell(2, 1, title.upper()).font = Font(name=A, bold=True, size=12)
    ws.cell(3, 1, 'Pembanding: database Portal GRADAKS per 17 November 2026').font = BF
    if ket: ws.cell(4, 1, ket).font = BF
    for j, (h, w) in enumerate(zip(hdr, widths), 1):
        c = ws.cell(6, j, h); c.font = HF; c.fill = HFILL; c.border = BOX
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws.column_dimensions[get_column_letter(j)].width = w
    ws.row_dimensions[6].height = 42
    for i, row in enumerate(data, 7):
        for j, v in enumerate(row, 1):
            c = ws.cell(i, j, v); c.font = BF; c.border = BOX
            num = isinstance(v, (int, float))
            c.alignment = Alignment(vertical='top', horizontal='center' if num else 'left', wrap_text=isinstance(v, str) and len(v) > widths[j - 1])
            if isinstance(v, float): c.number_format = '0.00'
    ws.freeze_panes = 'D7'; ws.auto_filter.ref = f'A6:{get_column_letter(len(hdr))}{6 + len(data)}'
    ws.page_setup.orientation = 'landscape'; ws.sheet_properties.pageSetUpPr.fitToPage = True; ws.page_setup.fitToHeight = 0


def base(v):
    r = D[v['nrp']]
    return [v['nrp'], v['nama'], v['dept'], v['inc'].replace('H', 'Hadir ').replace('/I', ', Izin ').replace('/A', ', Alpa '),
            v['temu'].replace('H', ' Hadir, ').replace('I', ' Izin, ').replace('A', ' Alpa').strip(), F[v['nrp']]['kat'],
            round(v['old'], 2), round(v['new'], 2), round(v['np'] or 0, 2), round(v['nk'] or 0, 2),
            round(r['components']['MATERI'] or 0, 2), 'Ya' if kosong(r) else 'Tidak']


H0 = ['NRP', 'Nama', 'Departemen', 'Kehadiran Inclenation', 'Kehadiran Temu FTEIC (5 sesi)', 'Kategori di Berkas', 'Rata-rata di Berkas',
      'Rata-rata Database', 'Nilai Personal (DB)', 'Nilai Keahlian (DB)', 'Penilaian Materi (DB)', 'Evaluasi Mentor Kosong']
W0 = [13, 32, 18, 22, 24, 18, 11, 11, 11, 11, 11, 11]

cases = []
def add(nrp_or_name, kasus, saran):
    v = rows.get(nrp_or_name) or next(x for x in rows.values() if x['nama'].startswith(nrp_or_name))
    cases.append(base(v) + [kasus, saran])

add('Keysa Adila Ningtias', 'Kategori "LULUS DG CATATAN" tidak ada dalam aturan. Rata-rata di berkas 29,7 (di bawah 30), di database 31,6.',
    'Tetapkan menjadi Lulus Bersyarat atau Tidak Lulus sesuai aturan final.')
add('Rafi Anas Praja Kisaura', 'Izin 2 hari Inclenation, tetapi alpa 4 dari 5 Temu FTEIC. Tidak memenuhi syarat "Temu FTEIC ikut terus".',
    'Tinjau ulang status Lulus Bersyarat.')
add('Ghaza Kaysan Akmal', 'Izin 2 hari Inclenation, alpa 2 Temu FTEIC, Penilaian Materi 20,7 dan Nilai Personal 36,6. Sulit disebut "nilai bagus".',
    'Tinjau ulang status Lulus Bersyarat.')
add('Aida Bilmafaza', 'Izin 2 hari Inclenation, alpa 1 Temu FTEIC, Nilai Personal 52,4 (predikat Kurang).',
    'Perlu ambang "nilai bagus" yang jelas untuk memutuskan.')
add('Nabilah Izzati Rahma Alifia', 'Izin 2 hari Inclenation, hadir 5 Temu FTEIC, tetapi Penilaian Materi 35,5. Lulus karena Nilai Keahlian 78,0.',
    'Sesuai bila acuan rata-rata; tidak sesuai bila acuan nilai materi.')
add('Daniel Timothy Taruna', 'Hadir 1 hari dan alpa 1 hari (bukan izin). Kasus ini tidak tercakup aturan 1-3.',
    'Tambahkan aturan untuk hadir 1 hari + alpa 1 hari.')
add('Ahmad Rafi Hasudungan', 'Hadir 1 hari dan alpa 1 hari, alpa 5 dari 5 Temu FTEIC. Tidak tercakup aturan 1-3.',
    'Tidak Lulus sudah wajar, tetapi aturannya perlu dituliskan.')
add('Najihah Hubbi', 'Hadir 1 hari dan alpa 1 hari, alpa 5 dari 5 Temu FTEIC. Tidak tercakup aturan 1-3.',
    'Tidak Lulus sudah wajar, tetapi aturannya perlu dituliskan.')
add('Muhammad Hilmi Mu', 'Izin 2 hari Inclenation dan hadir 3 Temu FTEIC, tetapi Tidak Lulus (rata-rata 21,4). Bandingkan dengan Maba hadir 2 hari yang tidak pernah hadir Temu FTEIC namun Lulus.',
    'Pastikan perlakuan setara antara kasus ini dan kelompok Lulus dengan rata-rata di bawah 30.')
add('Sarah Nadia Humaira', 'Lulus Bersyarat dengan Nilai Personal 82,9, tetapi Nilai Keahlian 1,3 karena evaluasi mentor kosong.',
    'Lengkapi evaluasi mentor; status lulus tidak berubah.')
for v in sorted([x for x in rows.values() if x['kat'] == 'LULUS' and x['new'] < 30], key=lambda x: x['new']):
    add(v['nrp'], 'Hadir 2 hari Inclenation sehingga Lulus otomatis (aturan 1), tetapi rata-rata di bawah 30 dan hampir tidak mengikuti Temu FTEIC.',
        'Putuskan apakah aturan 1 perlu syarat nilai minimal; minimal ditandai untuk pendampingan HMD.')

wb = Workbook()
sheet(wb, 'Kasus Ditinjau', 'Kasus Kelulusan IPF yang Perlu Ditinjau', 'Daftar Maba yang statusnya perlu diputuskan atau aturannya perlu diperjelas.',
      H0 + ['Temuan', 'Saran'], cases, W0 + [55, 45], first=True)

allr = []
for n, f in F.items():
    v = rows[n]; r = D[n]
    elig_file = f['status']; elig_db = 'Layak' if r['eligible'] else 'Tidak layak diagregasi'
    allr.append(base(v) + [elig_file, elig_db, 'Berbeda' if (elig_file == 'Layak') != r['eligible'] else 'Sama',
                           round(float(f['np']) - (r['personal'] or 0), 2), round(float(f['nk']) - (r['skill'] or 0), 2)])
allr.sort(key=lambda x: (x[2], x[0]))
sheet(wb, 'Perbandingan Seluruh Maba', 'Perbandingan Berkas Kelulusan dengan Database', 'Selisih = nilai di berkas dikurangi nilai di database. Selisih bukan nol berarti berkas memakai data yang lebih lama.',
      H0 + ['Status Agregasi di Berkas', 'Status Agregasi Database', 'Status Agregasi', 'Selisih Nilai Personal', 'Selisih Nilai Keahlian'], allr, W0 + [16, 16, 11, 11, 11])
wb.save(OUT); print('ok', len(cases), len(allr))
