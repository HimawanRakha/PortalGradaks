"""Laporan pengembangan Maba per HMD — memakai template (cover, header, footer) dan menulis ulang isi."""
import json, sys, copy, re, hashlib, os, datetime
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BASE, DEPT, TPL, OUT, XLSX, DATE, FINALNAME = sys.argv[1:8]
S = json.load(open(f'{BASE}/work/stats_{DEPT}.json', encoding='utf8'))
SHEETS = json.load(open(f'{BASE}/work/sheets_{DEPT}.json', encoding='utf8'))
DN = S['deptName']
FIG = f'{BASE}/work/fig_{DEPT}_'

# ---------------- formatting helpers ----------------
def n(x): return f'{int(round(x)):,}'.replace(',', '.')
def f1(x, d=1): return '–' if x is None else f'{x:.{d}f}'.replace('.', ',')
def f2(x): return f1(x, 2)
def p(x, d=1): return '–' if x is None else f1(x * 100, d) + '%'
def np_(a, b, d=1): return f'{n(a)} ({p(a / b, d)})' if b else n(a)
PL = {'SB': 'Sangat Baik', 'B': 'Baik', 'C': 'Cukup', 'K': 'Kurang'}

doc = Document(TPL)
body = doc.element.body

# ---- strip template body after the TOC, keep cover + DAFTAR ISI + TOC + final sectPr
kids = list(body)
toc_i = next(i for i, e in enumerate(kids) if e.tag == qn('w:sdt'))
for e in kids[toc_i + 1:]:
    if e.tag != qn('w:sectPr'): body.remove(e)
for r in kids[toc_i - 1].iter(qn('w:color')): r.set(qn('w:val'), '000000')

# ---- black & white heading styles
st_el = doc.styles.element
for s in st_el.iter(qn('w:style')):
    if s.get(qn('w:styleId')) in ('Heading1', 'Heading2', 'Heading3'):
        nm = s.find(qn('w:name')); nm.set(qn('w:val'), nm.get(qn('w:val')).lower())
        for c in s.iter(qn('w:color')): c.set(qn('w:val'), '000000')
        for b in s.iter(qn('w:bottom')):
            b.set(qn('w:color'), '000000'); b.set(qn('w:sz'), '8')
doc.styles['Heading 1'].paragraph_format.page_break_before = True
doc.styles['Heading 2'].paragraph_format.space_before = Pt(16)
doc.styles['Heading 3'].paragraph_format.space_before = Pt(10)

sectPr = body.find(qn('w:sectPr'))
def _move(el):
    body.remove(el); sectPr.addprevious(el); return el

# numbering
numbering = doc.part.numbering_part.element
_num_id = [100]
def new_num(abstract):
    _num_id[0] += 1
    num = OxmlElement('w:num'); num.set(qn('w:numId'), str(_num_id[0]))
    a = OxmlElement('w:abstractNumId'); a.set(qn('w:val'), str(abstract)); num.append(a)
    lo = OxmlElement('w:lvlOverride'); lo.set(qn('w:ilvl'), '0')
    so = OxmlElement('w:startOverride'); so.set(qn('w:val'), '1'); lo.append(so); num.append(lo)
    numbering.append(num)
    return _num_id[0]

BODY_PT = 11.5

def add_runs(par, text, size=BODY_PT, italic=False):
    # **bold** markup
    for i, part in enumerate(re.split(r'\*\*', text)):
        if not part: continue
        r = par.add_run(part); r.font.size = Pt(size); r.bold = bool(i % 2); r.italic = italic
        r.font.color.rgb = RGBColor(0, 0, 0)
    return par

def P(text, align='j', size=BODY_PT, after=8, before=0, italic=False, keep=False, indent=None):
    par = doc.add_paragraph(); _move(par._p)
    pf = par.paragraph_format
    pf.alignment = {'j': WD_ALIGN_PARAGRAPH.JUSTIFY, 'c': WD_ALIGN_PARAGRAPH.CENTER, 'l': WD_ALIGN_PARAGRAPH.LEFT, 'r': WD_ALIGN_PARAGRAPH.RIGHT}[align]
    pf.space_after = Pt(after); pf.space_before = Pt(before); pf.line_spacing = 1.15
    if keep: pf.keep_with_next = True
    if indent is not None: pf.left_indent = Cm(indent)
    add_runs(par, text, size, italic)
    return par

def H(text, level):
    par = doc.add_heading(level=level); _move(par._p)
    r = par.add_run(text); r.font.color.rgb = RGBColor(0, 0, 0)
    return par

def LIST(items, kind='bullet'):
    nid = new_num(2 if kind == 'bullet' else 3)
    for it in items:
        par = P(it, after=4)
        pPr = par._p.get_or_add_pPr()
        numPr = OxmlElement('w:numPr')
        il = OxmlElement('w:ilvl'); il.set(qn('w:val'), '0'); numPr.append(il)
        ni = OxmlElement('w:numId'); ni.set(qn('w:val'), str(nid)); numPr.append(ni)
        pPr.insert(0, numPr)
        ps = OxmlElement('w:pStyle'); ps.set(qn('w:val'), 'ListParagraph'); pPr.insert(0, ps)
    doc.paragraphs[-1].paragraph_format.space_after = Pt(8)

_tab = [0]; _fig = [0]; _chap = [0]
def CAP_T(title):
    _tab[0] += 1
    return P(f'**Tabel {_chap[0]}.{_tab[0]} {title}**', align='c', size=11, after=4, before=6, keep=True)

def CAP_F(title):
    _fig[0] += 1
    return P(f'**Gambar {_chap[0]}.{_fig[0]} {title}**', align='c', size=11, after=10, before=2)

def CHAP(title):
    _chap[0] += 1; _tab[0] = 0; _fig[0] = 0
    return H(f'{_chap[0]}. {title}', 1)

def SEC(num, title): return H(f'{_chap[0]}.{num} {title}', 2)

def _borders(tbl, show=True):
    tblPr = tbl._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{side}')
        e.set(qn('w:val'), 'single' if show else 'nil'); e.set(qn('w:sz'), '4'); e.set(qn('w:color'), '000000')
        b.append(e)
    tblPr.append(b)

def TABLE(headers, rows, widths, align=None, size=9.5, bold_last=False, header=True, borders=True):
    ncol = len(widths)
    tbl = doc.add_table(rows=0, cols=ncol); _move(tbl._tbl)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    _borders(tbl, borders)
    tw = sum(widths)
    tblW = tbl._tbl.tblPr.find(qn('w:tblW'))
    if tblW is None:
        tblW = OxmlElement('w:tblW'); tbl._tbl.tblPr.append(tblW)
    tblW.set(qn('w:w'), str(int(Cm(tw).twips))); tblW.set(qn('w:type'), 'dxa')
    grid = tbl._tbl.tblGrid
    for gc, w in zip(grid.findall(qn('w:gridCol')), widths): gc.set(qn('w:w'), str(int(Cm(w).twips)))
    align = align or (['l'] + ['c'] * (ncol - 1))
    allrows = ([headers] if header else []) + rows
    for ri, row in enumerate(allrows):
        cells = tbl.add_row().cells
        is_h = header and ri == 0
        if is_h:
            trPr = tbl.rows[ri]._tr.get_or_add_trPr()
            th = OxmlElement('w:tblHeader'); th.set(qn('w:val'), 'true'); trPr.append(th)
        trPr = tbl.rows[ri]._tr.get_or_add_trPr()
        cs = OxmlElement('w:cantSplit'); trPr.append(cs)
        for ci, (cell, val) in enumerate(zip(cells, row)):
            cell.width = Cm(widths[ci])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            par = cell.paragraphs[0]
            par.paragraph_format.space_after = Pt(1); par.paragraph_format.space_before = Pt(1)
            par.paragraph_format.line_spacing = 1.0
            a = 'c' if is_h else align[ci]
            par.paragraph_format.alignment = {'l': WD_ALIGN_PARAGRAPH.LEFT, 'c': WD_ALIGN_PARAGRAPH.CENTER, 'r': WD_ALIGN_PARAGRAPH.RIGHT, 'j': WD_ALIGN_PARAGRAPH.JUSTIFY}[a]
            txt = '' if val is None else str(val)
            b = is_h or (bold_last and ri == len(allrows) - 1)
            add_runs(par, f'**{txt}**' if b and txt else txt, size)
            if ri < len(allrows) - 1 and (len(allrows) <= 25 or ri < 2):
                par.paragraph_format.keep_with_next = True
    sp = P('', after=6); sp.paragraph_format.space_before = Pt(0)
    return tbl

def IMG(path, width_cm=15.5):
    par = doc.add_paragraph(); _move(par._p)
    par.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    par.paragraph_format.keep_with_next = True
    par.add_run().add_picture(path, width=Cm(width_cm))

def PB():
    par = doc.add_paragraph(); _move(par._p); par.add_run().add_break(WD_BREAK.PAGE)

