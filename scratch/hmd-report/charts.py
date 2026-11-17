"""Grafik berwarna untuk laporan HMD (fokus departemen, tanpa pembanding FTEIC)."""
import json, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
from matplotlib.ticker import FuncFormatter

BASE, DEPT = sys.argv[1], sys.argv[2]
S = json.load(open(f'{BASE}/work/stats_{DEPT}.json', encoding='utf8'))
R = json.load(open(f'{BASE}/work/rows_{DEPT}.json', encoding='utf8'))
OUT = f'{BASE}/work/fig_{DEPT}_'
plt.rcParams.update({'font.family': 'Times New Roman', 'font.size': 10, 'axes.edgecolor': '#555555',
                     'axes.linewidth': 0.8, 'savefig.dpi': 220, 'axes.titleweight': 'bold'})
idn = lambda v, d=1: f'{v:.{d}f}'.replace('.', ',')
pct = FuncFormatter(lambda v, _: f'{v:.0f}%')
NAVY, GOLD = '#1F3864', '#C9A227'
BIDC = {'Kewirausahaan': '#E07B39', 'Minat Bakat': '#8E5EA2', 'Keilmiahan': '#2E86AB', 'Manajerial': '#3B9C5A'}
PREDC = {'SB': '#3B9C5A', 'B': '#5B9BD5', 'C': '#F2C14E', 'K': '#E06666'}
PREDL = {'SB': 'Sangat Baik', 'B': 'Baik', 'C': 'Cukup', 'K': 'Kurang'}
QC = {'Unggulan': '#3B9C5A', 'Berkembang': '#5B9BD5', 'Laten': '#F2C14E', 'Pasif': '#F4A261', 'Rendah': '#BFBFBF'}
GRPC = {'Inclenation': GOLD, 'Temu FTEIC': NAVY, 'Kegiatan Besar': '#2E86AB'}


def clean(ax):
    ax.spines[['top', 'right']].set_visible(False)
    ax.grid(axis='x', color='#e5e5e5', lw=0.6); ax.set_axisbelow(True)


def save(fig, name):
    fig.tight_layout(); fig.savefig(OUT + name); plt.close(fig)


# 1. Kehadiran per sesi
ss = S['sessions']
fig, ax = plt.subplots(figsize=(6.5, 4.4))
y = range(len(ss))
bars = ax.barh(list(y), [s['pctH'] * 100 for s in ss], color=[GRPC[s['group']] for s in ss], height=0.65)
for b in bars: ax.text(b.get_width() + 1, b.get_y() + b.get_height() / 2, idn(b.get_width()) + '%', va='center', fontsize=8.5)
ax.set_yticks(list(y)); ax.set_yticklabels([s['nice'] for s in ss]); ax.invert_yaxis()
ax.set_xlim(0, 110); ax.xaxis.set_major_formatter(pct); ax.set_xlabel('Persentase Maba hadir')
for g, c in GRPC.items(): ax.bar(0, 0, color=c, label=g)
ax.legend(frameon=False, fontsize=8.5, ncol=3, loc='upper center', bbox_to_anchor=(0.4, 1.09))
clean(ax); save(fig, 'att.png')

# 2. Status agregasi + sebaran alpa
fig, (a1, a2) = plt.subplots(1, 2, figsize=(6.5, 2.8), gridspec_kw={'width_ratios': [1, 1.5]})
vals = [S['nTL'], S['nTnot']]
a1.pie(vals, colors=['#3B9C5A', '#E06666'], startangle=90, wedgeprops=dict(width=0.42, edgecolor='white'),
       labels=[f'Layak\n{vals[0]} ({idn(vals[0] / S["nT"] * 100)}%)', f'Tidak layak\n{vals[1]} ({idn(vals[1] / S["nT"] * 100)}%)'], textprops={'fontsize': 8.5})
a1.set_title('Status agregasi', fontsize=10)
ab = S['alpaBins']
cols = ['#3B9C5A', '#8BC34A', '#F2C14E', '#F4A261', '#E06666']
b = a2.bar(['0' if x['label'].startswith('Tidak') else x['label'].replace('Alpa ', '').replace(' sesi', '').replace(' atau lebih', '+') for x in ab], [x['all'] for x in ab], color=cols)
for r in b: a2.text(r.get_x() + r.get_width() / 2, r.get_height() + 3, str(int(r.get_height())), ha='center', fontsize=8.5)
a2.set_title('Jumlah Maba menurut banyaknya alpa', fontsize=10); a2.set_ylabel('Jumlah Maba'); a2.set_xlabel('Jumlah sesi alpa (dari 13 sesi)')
a2.tick_params(axis='x', labelsize=8); a2.spines[['top', 'right']].set_visible(False)
save(fig, 'status.png')

# 3. Predikat Nilai Personal & Keahlian (stacked 100%)
fig, ax = plt.subplots(figsize=(6.5, 1.9))
for i, (key, lab) in enumerate([('personal', 'Nilai Personal'), ('skill', 'Nilai Keahlian')]):
    pd_ = S[key]['pd']; left = 0
    for k in ['SB', 'B', 'C', 'K']:
        w = pd_[k][1] * 100
        ax.barh(i, w, left=left, color=PREDC[k], label=PREDL[k] if i == 0 else None, height=0.6)
        if w >= 5: ax.text(left + w / 2, i, f'{w:.0f}%', ha='center', va='center', fontsize=8.5, color='white' if k in ('SB', 'B', 'K') else 'black')
        left += w
ax.set_yticks([0, 1]); ax.set_yticklabels(['Nilai Personal', 'Nilai Keahlian']); ax.invert_yaxis()
ax.set_xlim(0, 100); ax.xaxis.set_major_formatter(pct)
ax.legend(frameon=False, ncol=4, fontsize=8.5, loc='upper center', bbox_to_anchor=(0.5, 1.35)); ax.spines[['top', 'right']].set_visible(False)
save(fig, 'pred.png')

# 4. Sub-nilai
sub = S['subnilai']
fig, ax = plt.subplots(figsize=(6.5, 2.8))
gc = {'A': GOLD, 'B': NAVY, 'C': '#2E86AB'}
bars = ax.barh([f"{s['code']} {s['label']}" for s in sub], [s['t']['mean'] for s in sub], color=[gc[s['code'][0]] for s in sub], height=0.6)
for b in bars: ax.text(b.get_width() + 0.6, b.get_y() + b.get_height() / 2, idn(b.get_width()), va='center', fontsize=8.5)
ax.set_xlim(0, 105); ax.invert_yaxis(); ax.set_xlabel('Rerata (0–100)')
for k, l in [('A', 'Kolektif'), ('B', 'Kolaboratif'), ('C', 'Kontributif')]: ax.bar(0, 0, color=gc[k], label=l)
ax.legend(frameon=False, fontsize=8.5, ncol=3, loc='upper center', bbox_to_anchor=(0.4, 1.15))
clean(ax); save(fig, 'sub.png')

# 5. Bidang keahlian: evaluasi mentor vs nilai bidang
sk = S['skillcat']
fig, ax = plt.subplots(figsize=(6.5, 2.9))
x = range(len(sk)); w = 0.38
b1 = ax.bar([i - w / 2 for i in x], [c['mentor']['mean'] for c in sk], w, color=[BIDC[c['label']] for c in sk], label='Evaluasi mentor')
b2 = ax.bar([i + w / 2 for i in x], [c['t']['mean'] for c in sk], w, color=[BIDC[c['label']] for c in sk], alpha=0.45, hatch='//', edgecolor='white', label='Nilai bidang (raport)')
for bs in (b1, b2):
    for r in bs: ax.text(r.get_x() + r.get_width() / 2, r.get_height() + 1, idn(r.get_height()), ha='center', fontsize=8.5)
ax.set_xticks(list(x)); ax.set_xticklabels([c['label'] for c in sk]); ax.set_ylim(0, 105); ax.set_ylabel('Rerata (0–100)')
ax.legend(frameon=False, fontsize=8.5, ncol=2, loc='upper center', bbox_to_anchor=(0.5, 1.15)); ax.spines[['top', 'right']].set_visible(False)
save(fig, 'skill.png')

# 6. Minat per bidang (rerata saja)
q = S['q1b']
labs = [b['label'] for b in q]
fig, a1 = plt.subplots(figsize=(4.6, 3.0))
b = a1.bar(labs, [b['t']['mean'] for b in q], color=[BIDC[l] for l in labs])
for r in b: a1.text(r.get_x() + r.get_width() / 2, r.get_height() + 0.04, idn(r.get_height(), 2), ha='center', fontsize=8.5)
a1.set_ylim(1, 4); a1.set_title('Rerata skor minat (1–4)', fontsize=10); a1.axhline(3, color='#888', ls=':', lw=0.8)
a1.tick_params(axis='x', labelsize=8, rotation=15); a1.spines[['top', 'right']].set_visible(False)
save(fig, 'minat.png')

# 7. Kuadran potensi
fig, ax = plt.subplots(figsize=(6.5, 2.4))
nv = S['q1']['valid']; left = [0] * 4
order = ['Unggulan', 'Berkembang', 'Laten', 'Pasif', 'Rendah']
for o in order:
    vals = [b['quad'].get(o, 0) / nv * 100 for b in q]
    ax.barh(labs, vals, left=left, color=QC[o], label=o, height=0.6)
    for i, v in enumerate(vals):
        if v >= 6: ax.text(left[i] + v / 2, i, f'{v:.0f}%', ha='center', va='center', fontsize=8, color='white' if o in ('Unggulan', 'Berkembang') else 'black')
    left = [l + v for l, v in zip(left, vals)]
ax.set_xlim(0, 100); ax.xaxis.set_major_formatter(pct); ax.invert_yaxis()
ax.legend(frameon=False, fontsize=8.5, ncol=5, loc='upper center', bbox_to_anchor=(0.5, 1.22)); ax.spines[['top', 'right']].set_visible(False)
save(fig, 'quad.png')

# 8. K1 vs GRADAKS
cb = S['cmpBid']
fig, (a1, a2) = plt.subplots(1, 2, figsize=(6.5, 3.0), gridspec_kw={'width_ratios': [1.6, 1]})
x = range(len(cb)); w = 0.38
b1 = a1.bar([i - w / 2 for i in x], [c['hiK'] / c['n'] * 100 for c in cb], w, color='#F2C14E', label='Minat tinggi (K1)')
b2 = a1.bar([i + w / 2 for i in x], [c['sbG'] / c['n'] * 100 for c in cb], w, color=NAVY, label='Sangat Baik (GRADAKS)')
for bs in (b1, b2):
    for r in bs: a1.text(r.get_x() + r.get_width() / 2, r.get_height() + 1, f'{r.get_height():.0f}', ha='center', fontsize=8)
a1.set_xticks(list(x)); a1.set_xticklabels([c['label'] for c in cb], fontsize=8, rotation=15); a1.set_ylim(0, 100)
a1.yaxis.set_major_formatter(pct); a1.legend(frameon=False, fontsize=8, loc='upper left', ncol=2); a1.spines[['top', 'right']].set_visible(False)
a1.set_title('Persentase Maba per bidang', fontsize=10)
cm = S['cmp']
keys = ['Sesuai', 'Berbeda', 'Penilaian GRADAKS seimbang di semua bidang']
lab2 = ['Sesuai', 'Berbeda', 'Seimbang']
v = [cm.get(k, 0) for k in keys]
a2.pie(v, colors=['#3B9C5A', '#E06666', '#BFBFBF'], startangle=90, wedgeprops=dict(width=0.42, edgecolor='white'),
       labels=[f'{l}\n{n_}' for l, n_ in zip(lab2, v)], textprops={'fontsize': 8})
a2.set_title('Bidang teratas K1 vs GRADAKS', fontsize=10)
save(fig, 'cmp.png')

# 9. Alur proses nilai (diagram)
fig, ax = plt.subplots(figsize=(6.6, 4.6)); ax.axis('off'); ax.set_xlim(0, 100); ax.set_ylim(0, 100)


def box(x, y, w, h, t, c, tc='white', fs=8.2):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.4,rounding_size=1.5', fc=c, ec='none'))
    ax.text(x + w / 2, y + h / 2, t, ha='center', va='center', color=tc, fontsize=fs, wrap=True)


def arrow(x1, y1, x2, y2):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle='-|>', color='#555', lw=1))


ax.text(2, 97, 'INPUT', fontsize=9, fontweight='bold', color='#555'); ax.text(38, 97, 'PENGOLAHAN', fontsize=9, fontweight='bold', color='#555'); ax.text(75, 97, 'HASIL', fontsize=9, fontweight='bold', color='#555')
inputs = [(84, 'Presensi sesi\n(Hadir / Izin / Alpa)'), (70, 'Rubrik materi & kuis\n(skala 1–4 / 0–100)'), (56, 'Keaktifan sesi\n(skala 1–4)'),
          (42, 'Evaluasi logbook\nper bidang (1–4)'), (28, 'Kegiatan Keahlian &\nPenilaian Manajerial'), (12, 'Kuesioner 1 & MBTI\n(pernyataan diri)')]
for y, t in inputs: box(1, y, 27, 9, t, '#DDEBF7', tc='black')
box(37, 80, 28, 13, 'Skor kehadiran\nH=100, I=50, A=0', GOLD, tc='black')
box(37, 56, 28, 17, 'Normalisasi 0–100,\nrata-rata per sub-nilai\n(A.1–C.2), bobot AHP', NAVY)
box(37, 33, 28, 15, 'Per bidang:\n80% evaluasi mentor +\n20% komponen kegiatan', '#2E86AB')
box(37, 9, 28, 15, 'Minat, rekam jejak,\nkuadran potensi', '#8E5EA2')
box(73, 70, 26, 18, 'NILAI PERSONAL\n60% kehadiran +\n40% Penilaian Materi', NAVY, fs=8.4)
box(73, 36, 26, 15, 'NILAI KEAHLIAN\nrata-rata 4 bidang', '#2E86AB', fs=8.4)
box(73, 9, 26, 15, 'PETA MINAT &\nPOTENSI', '#8E5EA2', fs=8.4)
for (y1, y2) in [(88, 86), (74, 64), (60, 62), (46, 40), (32, 40), (16, 16)]: arrow(28.5, y1, 36.5, y2)
arrow(65.5, 86, 72.5, 80); arrow(65.5, 64, 72.5, 76); arrow(65.5, 40, 72.5, 43); arrow(65.5, 16, 72.5, 16)
ax.text(51, 51, '', fontsize=7)
save(fig, 'flow.png')
print('charts ok')
