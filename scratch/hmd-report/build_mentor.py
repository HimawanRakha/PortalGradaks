"""Rekap kehadiran mentor angkatan 2025 per departemen (desain formal sederhana)."""
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, Border, Side, Alignment, PatternFill
from openpyxl.utils import get_column_letter
BASE, DEPT, OUTF = sys.argv[1:4]
DATE = sys.argv[4] if len(sys.argv) > 4 else '16 November 2026'
S = json.load(open(f'{BASE}/work/stats_{DEPT}.json', encoding='utf8'))
F = 'Arial'
thin = Side(style='thin', color='000000'); BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
HF = Font(name=F, bold=True, size=10); HFILL = PatternFill('solid', fgColor='D9D9D9')
BF = Font(name=F, size=10); TF = Font(name=F, bold=True, size=12)
STAT = {'HADIR': 'H', 'IZIN': 'I', 'ALPA': 'A', None: '-'}

wb = Workbook(); ws = wb.active; ws.title = 'Rekap Mentor'
ws.cell(1, 1, 'BADAN EKSEKUTIF MAHASISWA FTEIC ITS').font = BF
ws.cell(2, 1, 'REKAPITULASI KEHADIRAN MENTOR ANGKATAN 2025').font = TF
ws.cell(3, 1, f"Departemen {S['deptName']}, data per {DATE}").font = BF
ws.cell(4, 1, 'Keterangan: H = Hadir, I = Izin, A = Alpa, - = tidak tercatat (tidak dihitung sebagai alpa). '
              'Persentase hadir dihitung dari sesi yang tercatat. Keaktifan adalah rata-rata skor 1-4 dari Kepala Region.').font = BF
HR = 6
H = ['No', 'NRP', 'Nama Mentor', 'Unit yang Dibina', 'Region', 'Jumlah Maba Dibina'] + S['mentorSess'] + \
    ['Hadir', 'Izin', 'Alpa', 'Tidak Tercatat', 'Persentase Hadir', 'Keaktifan (1-4)']
W = [5, 13, 34, 22, 34, 11] + [11] * len(S['mentorSess']) + [8, 8, 8, 10, 12, 13]
for j, (h, w) in enumerate(zip(H, W), 1):
    c = ws.cell(HR, j, h); c.font = HF; c.fill = HFILL; c.border = BOX
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws.column_dimensions[get_column_letter(j)].width = w
ws.row_dimensions[HR].height = 42
for i, m in enumerate(S['mentors'], 1):
    row = [i, m['nrp'], m['name'], m['unit'], m['region'], m['nmaba']] + [STAT.get(v, v) for v in m['status']] + \
          [m['H'], m['I'], m['A'], m['TC'], m['pct'], round(m['keaktifan'], 2) if m['keaktifan'] is not None else None]
    for j, v in enumerate(row, 1):
        c = ws.cell(HR + i, j, v); c.font = BF; c.border = BOX
        c.alignment = Alignment(vertical='top', horizontal='left' if j in (3, 4, 5) else 'center')
        if j == len(H) - 1: c.number_format = '0%'
        elif j == len(H): c.number_format = '0.00'
end = HR + len(S['mentors'])
ws.freeze_panes = ws.cell(HR + 1, 4)
ws.auto_filter.ref = f'A{HR}:{get_column_letter(len(H))}{end}'
ws.page_setup.orientation = 'landscape'; ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0; ws.print_title_rows = f'{HR}:{HR}'
wb.save(OUTF); print('mentor ok', OUTF)
