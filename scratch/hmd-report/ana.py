"""Statistik laporan HMD: membaca data/all.json (dump DB) + Data_Olah Kuesioner 1."""
import json, re, statistics as st, collections as C, difflib, sys
import openpyxl
from scipy import stats as sps

BASE = sys.argv[1] if len(sys.argv) > 1 else '.'
DEPT = sys.argv[2] if len(sys.argv) > 2 else 'IF'

d = json.load(open(f'{BASE}/data/all.json', encoding='utf8'))
ALL = d['rows']
DEPT_NAME = next(x['name'] for x in d['departments'] if x['code'] == DEPT)
T = [r for r in ALL if r['departmentCode'] == DEPT]
TL = [r for r in T if r['eligible']]
FL = [r for r in ALL if r['eligible']]
TH = {'SB': 85, 'B': 70, 'C': 55}

SUB = [('A.1', 'Kebersamaan', 0.02), ('A.2', 'Kebanggaan Fakultas', 0.3787), ('B.1', 'Manajemen Diri', 0.2609),
       ('B.2', 'Kerja Sama', 0.1755), ('C.1', 'Problem Solving', 0.1172), ('C.2', 'Kepekaan Sosial', 0.0476)]
GROUPS = [('A', 'Kolektif', ['A.1', 'A.2']), ('B', 'Kolaboratif', ['B.1', 'B.2']), ('C', 'Kontributif', ['C.1', 'C.2'])]
SK = [('M', 'Manajerial'), ('K', 'Keilmiahan'), ('MB', 'Minat Bakat'), ('KW', 'Kewirausahaan')]
COMP = [('TEMU_FTEIC', 'Kehadiran Temu FTEIC', 0.25), ('KEGIATAN_BESAR', 'Kehadiran Kegiatan Besar', 0.25),
        ('INCLENATION', 'Kehadiran Inclenation', 0.10), ('MATERI', 'Penilaian Materi', 0.40)]


def pred(v):
    if v is None: return None
    return 'SB' if v >= TH['SB'] else 'B' if v >= TH['B'] else 'C' if v >= TH['C'] else 'K'


def summ(vals):
    v = [x for x in vals if x is not None]
    if not v: return dict(n=0)
    q = st.quantiles(v, n=4) if len(v) > 1 else [v[0]] * 3
    return dict(n=len(v), mean=st.mean(v), median=st.median(v), sd=st.stdev(v) if len(v) > 1 else 0,
                min=min(v), max=max(v), q1=q[0], q3=q[2])


def pdist(vals):
    v = [x for x in vals if x is not None]
    c = C.Counter(pred(x) for x in v)
    n = len(v) or 1
    return {k: (c[k], c[k] / n) for k in ['SB', 'B', 'C', 'K']} | {'n': len(v)}


S = {'dept': DEPT, 'deptName': DEPT_NAME, 'nT': len(T), 'nF': len(ALL), 'nTL': len(TL), 'nFL': len(FL)}
S['nTnot'] = len(T) - len(TL)
S['nFnot'] = len(ALL) - len(FL)
S['prodi'] = sorted(C.Counter(r['nrp'][:4] for r in T).items())

# ---------- region / unit / mentor ----------
units = {u['code']: u for u in d['units']}
kareg = {}
for k in d['kareg']:
    if k['region']: kareg.setdefault(k['region']['name'], []).append(k['name'])
reg = C.defaultdict(lambda: dict(n=0, layak=0, units=set(), mentors=set()))
for r in T:
    g = reg[r['region']]
    g['n'] += 1; g['layak'] += r['eligible']; g['units'].add(r['unitCode'])
    m = units.get(r['unitCode'], {}).get('mentor')
    if m: g['mentors'].add(m['nrp'] or m['name'])
S['regions'] = [dict(region=k, n=v['n'], layak=v['layak'], tidak=v['n'] - v['layak'], units=len(v['units']),
                     mentors=len(v['mentors']), kareg=', '.join(sorted(kareg.get(k, []))) or '-',
                     perUnit=v['n'] / len(v['units'])) for k, v in sorted(reg.items())]
S['nUnits'] = len({r['unitCode'] for r in T})
S['nMentors'] = len({(units[r['unitCode']]['mentor'] or {}).get('nrp') for r in T if units.get(r['unitCode'], {}).get('mentor')})
S['nRegions'] = len(reg)
unit_tbl = C.defaultdict(lambda: dict(n=0, layak=0))
for r in T:
    u = unit_tbl[r['unitCode']]; u['n'] += 1; u['layak'] += r['eligible']
S['unitSizes'] = summ([u['n'] for u in unit_tbl.values()])

# ---------- attendance per session ----------
meta = d['meta']
SESS = []
for cat, label in [('INCLENATION', 'Inclenation'), ('TEMU_FTEIC', 'Temu FTEIC'), ('KEGIATAN_BESAR', 'Kegiatan Besar')]:
    for s in meta['sessionLists'][cat]:
        SESS.append(dict(id=s['id'], code=s['code'], cat=cat, group=label, name=s['name'], act=s['activityName']))
NICE = {'H1': 'Inclenation Hari 1', 'H2': 'Inclenation Hari 2', '0.0': 'Temu FTEIC 0 (Baseline)',
        '1.0': 'Temu FTEIC 1.0 (daring)', '1.1': 'Temu FTEIC 1.1 (luring)', '2.0': 'Temu FTEIC 2.0 (daring, kuis)',
        '3.1': 'Temu FTEIC 3.1 (luring, penutup)', 'PESRAF': 'Pesraf', 'SOSCOM': 'Social Community (Soscom)',
        'ARUS_EMAS_1': 'Arus Emas 1', 'ARUS_EMAS_2': 'Arus Emas 2', 'ARUS_EMAS_3': 'Arus Emas 3', 'COMPEX': 'Compex'}
for s in SESS: s['nice'] = NICE.get(s['code'], s['name'])


def sess_status(rows, sid):
    c = C.Counter(r['mandatorySessions'].get(sid) for r in rows)
    return c


for s in SESS:
    c = sess_status(T, s['id']); f = sess_status(ALL, s['id'])
    s.update(H=c['HADIR'], I=c['IZIN'], A=c['ALPA'], pctH=c['HADIR'] / len(T), pctHF=f['HADIR'] / len(ALL),
             held=(c['HADIR'] + c['IZIN'] + c['ALPA']) > 0)
S['sessions'] = SESS
held = [s for s in SESS if s['held']]
S['nHeld'] = len(held)
tot = len(T) * len(held)
S['attTot'] = dict(H=sum(s['H'] for s in held), I=sum(s['I'] for s in held), A=sum(s['A'] for s in held), slots=tot)
S['attTotF'] = dict(H=sum(sess_status(ALL, s['id'])['HADIR'] for s in held), slots=len(ALL) * len(held))
alpa = [sum(1 for s in held if r['mandatorySessions'].get(s['id']) == 'ALPA') for r in T]
izin = [sum(1 for s in held if r['mandatorySessions'].get(s['id']) == 'IZIN') for r in T]
hadir = [sum(1 for s in held if r['mandatorySessions'].get(s['id']) == 'HADIR') for r in T]
for r, a, i, h in zip(T, alpa, izin, hadir): r['_alpa'], r['_izin'], r['_hadir'] = a, i, h
S['meanHadir'] = st.mean(hadir); S['meanIzin'] = st.mean(izin); S['meanAlpa'] = st.mean(alpa)
bins = [('Tidak pernah alpa', 0, 0), ('Alpa 1–2 sesi', 1, 2), ('Alpa 3–4 sesi', 3, 4), ('Alpa 5–6 sesi', 5, 6),
        ('Alpa 7 sesi atau lebih', 7, 99)]
S['alpaBins'] = [dict(label=l, all=sum(1 for r in T if lo <= r['_alpa'] <= hi),
                      layak=sum(1 for r in TL if lo <= r['_alpa'] <= hi),
                      tidak=sum(1 for r in T if not r['eligible'] and lo <= r['_alpa'] <= hi)) for l, lo, hi in bins]
S['everIzin'] = sum(1 for x in izin if x > 0)

# components
S['components'] = []
for code, label, w in COMP:
    tv = [r['components'][code] for r in TL]; fv = [r['components'][code] for r in FL]
    S['components'].append(dict(code=code, label=label, w=w, t=summ(tv), f=summ(fv), pd=pdist(tv),
                                tAll=summ([r['components'][code] for r in T])))

# kegiatan keahlian
KL = meta['keahlianList']
S['keahlian'] = []
for k in KL:
    n = sum(1 for r in T if r['keahlianSessions'].get(k['code']) == 'HADIR')
    nf = sum(1 for r in ALL if r['keahlianSessions'].get(k['code']) == 'HADIR')
    S['keahlian'].append(dict(code=k['code'], name=k['name'], cat=dict(SK)[k['skillCategory']], n=n, pct=n / len(T),
                              pctF=nf / len(ALL)))
S['keahlianAny'] = sum(1 for r in T if r['keahlianAttended'] > 0)
S['keahlianAnyF'] = sum(1 for r in ALL if r['keahlianAttended'] > 0)

# ---------- eligibility detail ----------
nl = [r for r in T if not r['eligible']]
S['notTemu'] = sum(1 for r in nl if any('Temu' in x for x in r['reasons']))
S['notBesar'] = sum(1 for r in nl if any('Kegiatan Besar' in x for x in r['reasons']))
S['notBoth'] = sum(1 for r in nl if any('Temu' in x for x in r['reasons']) and any('Besar' in x for x in r['reasons']))
S['notBesarOnly'] = S['notBesar'] - S['notBoth']
S['notNoTemu'] = sum(1 for r in nl if r['attendance']['TEMU_FTEIC']['attended'] == 0 and
                     not any(r['mandatorySessions'].get(s['id']) == 'IZIN' for s in held if s['cat'] == 'TEMU_FTEIC'))
S['notNeverAny'] = sum(1 for r in nl if r['_hadir'] == 0)
S['notNP'] = summ([r['personal'] for r in nl])

# ---------- scores ----------
S['personal'] = dict(t=summ([r['personal'] for r in TL]), f=summ([r['personal'] for r in FL]),
                     tAll=summ([r['personal'] for r in T]), pd=pdist([r['personal'] for r in TL]),
                     pdNot=pdist([r['personal'] for r in nl]), pdF=pdist([r['personal'] for r in FL]))
S['skill'] = dict(t=summ([r['skill'] for r in TL]), f=summ([r['skill'] for r in FL]),
                  tAll=summ([r['skill'] for r in T]), pd=pdist([r['skill'] for r in TL]),
                  pdNot=pdist([r['skill'] for r in nl]), pdF=pdist([r['skill'] for r in FL]))
S['subnilai'] = []
for code, label, w in SUB:
    tv = [r['subNilai'][code] for r in TL]
    S['subnilai'].append(dict(code=code, label=label, w=w, t=summ(tv), f=summ([r['subNilai'][code] for r in FL]),
                              pd=pdist(tv)))
S['groups'] = []
for code, label, subs in GROUPS:
    tv = [next(g['score'] for g in r['groups'] if g['code'] == code) for r in TL]
    fv = [next(g['score'] for g in r['groups'] if g['code'] == code) for r in FL]
    S['groups'].append(dict(code=code, label=label, t=summ(tv), f=summ(fv)))
S['allSixSB'] = sum(1 for r in TL if all(pred(r['subNilai'][c]) == 'SB' for c, _, _ in SUB))

# items (butir)


def items_mean(rows):
    acc = C.defaultdict(list)
    for r in rows:
        for i in r['personalItems']:
            if i['label'].startswith('Kehadiran '): continue
            key = (i['label'], i['source'], ','.join(i['targets']))
            acc[key].append(i['norm'])
    return acc


ti_items, f_items = items_mean(TL), items_mean(FL)
ITEMS = []
for k, v in ti_items.items():
    lab, src, tg = k
    if lab.startswith('Keaktifan '): continue
    ITEMS.append(dict(label=lab, source=src, targets=tg, mean=st.mean(v), n=len(v),
                      meanF=st.mean(f_items[k]) if f_items.get(k) else None))
# keaktifan aggregated
ka = [i['norm'] for r in TL for i in r['personalItems'] if i['label'].startswith('Keaktifan ')]
kaf = [i['norm'] for r in FL for i in r['personalItems'] if i['label'].startswith('Keaktifan ')]
S['keaktifan'] = dict(mean=st.mean(ka), n=len(ka), meanF=st.mean(kaf))
S['keaktifanPerSess'] = []
for s in held:
    lab = 'Keaktifan ' + s['name']
    v = [i['norm'] for r in TL for i in r['personalItems'] if i['label'] == lab]
    if len(v) > 20: S['keaktifanPerSess'].append(dict(sess=s['nice'], n=len(v), mean=st.mean(v)))
ITEMS.sort(key=lambda x: (x['targets'], x['mean']))
S['items'] = ITEMS

# C.2 Kurang analysis
c2k = [r for r in TL if pred(r['subNilai']['C.2']) in ('K',)]
s2 = next(s for s in held if s['code'] == '2.0')
S['c2Kurang'] = len(c2k)
S['c2KurangNoTemu2'] = sum(1 for r in c2k if r['mandatorySessions'].get(s2['id']) == 'ALPA')
S['c2CK'] = sum(1 for r in TL if pred(r['subNilai']['C.2']) in ('C', 'K'))
S['c2CKNoTemu2'] = sum(1 for r in TL if pred(r['subNilai']['C.2']) in ('C', 'K') and r['mandatorySessions'].get(s2['id']) == 'ALPA')

# skill categories
S['skillcat'] = []
for code, label in SK:
    def g(r, f):
        return next(c for c in r['skillDetail'] if c['code'] == code)[f]
    tv = [r['skillCategories'][code]['score'] for r in TL]
    S['skillcat'].append(dict(code=code, label=label, t=summ(tv), f=summ([r['skillCategories'][code]['score'] for r in FL]),
                              mentor=summ([g(r, 'mentorScore') for r in TL]), mentorF=summ([g(r, 'mentorScore') for r in FL]),
                              keg=summ([g(r, 'activityScore') for r in TL]), pd=pdist(tv),
                              src=next(c for c in TL[0]['skillDetail'] if c['code'] == code)['activitySource']))
mraw = [next(c for c in r['skillDetail'] if c['code'] == 'M')['assessmentRaw'] for r in TL]
S['manajerialRaw'] = summ(mraw)
S['manajerialRawF'] = summ([next(c for c in r['skillDetail'] if c['code'] == 'M')['assessmentRaw'] for r in FL])
S['manajerialRawZero'] = sum(1 for x in mraw if not x)
# mentor-eval sub-items
sub3 = C.defaultdict(list)
for r in TL:
    for i in r['skillItems']:
        if i['origin'] != 'KOSONG': sub3[i['label']].append(i['norm'])
S['skillItems'] = {k: st.mean(v) for k, v in sub3.items()}
S['mentorEmpty'] = sum(1 for r in T if any(i['origin'] == 'KOSONG' for i in r['skillItems']))
S['mentorEmptyLayak'] = sum(1 for r in TL if any(i['origin'] == 'KOSONG' for i in r['skillItems']))
# top single bidang from mentor
tops = C.Counter(); tie = 0; none = 0
for r in TL:
    if any(i['origin'] == 'KOSONG' for i in r['skillItems']): none += 1; continue
    ms = {c['code']: c['mentorScore'] for c in r['skillDetail']}
    mx = max(ms.values()); best = [k for k, v in ms.items() if abs(v - mx) < 1e-9]
    if len(best) == 1: tops[best[0]] += 1
    else: tie += 1
S['topBidang'] = dict(tops); S['topTie'] = tie; S['topNone'] = none

# recommendation engine
S['rec'] = C.Counter((r['recommendation'] or {}).get('recommendation') for r in TL).most_common()

# ---------- logbook ----------
S['logbookPer'] = sorted(C.Counter(len(r['logbook']) for r in T).items())
S['logbookStatus'] = C.Counter(l['status'] for r in T for l in r['logbook'])
S['logbookPeriod'] = C.Counter(l['periodLabel'] for r in T for l in r['logbook'])
S['logbookAny'] = sum(1 for r in T if r['logbook'])
S['logbookAnyF'] = sum(1 for r in ALL if r['logbook']) / len(ALL)
S['logbookEntries'] = sum(len(r['logbook']) for r in T)

# ---------- MBTI ----------
rx = re.compile(r'^([EI])([SN])([TF])([JP])(?:-([AT]))?$')


def mb(r):
    m = rx.match(((r['personality'] or {}).get('mbtiType') or '').strip().upper())
    return m


tm = [mb(r) for r in T]; fm = [mb(r) for r in ALL]
tmv = [m for m in tm if m]; fmv = [m for m in fm if m]
S['mbtiN'] = len(tmv); S['mbtiNF'] = len(fmv)
dims = [('Energi', 1, 'E', 'Extraversion', 'I', 'Introversion'), ('Informasi', 2, 'S', 'Sensing', 'N', 'Intuition'),
        ('Keputusan', 3, 'T', 'Thinking', 'F', 'Feeling'), ('Gaya hidup', 4, 'J', 'Judging', 'P', 'Perceiving'),
        ('Identitas', 5, 'A', 'Assertive', 'T', 'Turbulent')]
S['mbtiDims'] = []
for name, gi, a, an, b, bn in dims:
    va = [m.group(gi) for m in tmv if m.group(gi)]; vf = [m.group(gi) for m in fmv if m.group(gi)]
    S['mbtiDims'].append(dict(dim=name, a=f'{an} ({a})', na=va.count(a), b=f'{bn} ({b})', nb=va.count(b), n=len(va),
                              pa=va.count(a) / len(va), pb=va.count(b) / len(va), paF=vf.count(a) / len(vf)))
tt = C.Counter(m.group(0)[:4] for m in tmv); ft = C.Counter(m.group(0)[:4] for m in fmv)
S['mbtiTypes'] = [(k, v, v / len(tmv), ft[k] / len(fmv)) for k, v in tt.most_common()]
temps = {'NT': 'Rational (NT)', 'NF': 'Idealist (NF)', 'SJ': 'Guardian (SJ)', 'SP': 'Artisan (SP)'}


def kg(m):
    return 'N' + m.group(3) if m.group(2) == 'N' else 'S' + m.group(4)


tk = C.Counter(kg(m) for m in tmv); fk = C.Counter(kg(m) for m in fmv)
S['keirsey'] = [(temps[k], tk[k], tk[k] / len(tmv), fk[k] / len(fmv)) for k in ['NT', 'NF', 'SJ', 'SP']]
for r, m in zip(T, tm): r['_mbti'] = m.group(0) if m else None

# ---------- Kuesioner 1 ----------
wb = openpyxl.load_workbook(f'{BASE}/xl/q1.xlsx', data_only=True)
ws = wb['Data_Olah']
hdr = [c.value for c in ws[1]]
Q = [dict(zip(hdr, r)) for r in ws.iter_rows(min_row=2, values_only=True) if r[0] is not None]
for q in Q:
    q['nrp'] = str(int(q['NRP'])) if isinstance(q['NRP'], (int, float)) else str(q['NRP'] or '').strip()
QK = [q for q in Q if not str(q['Status Duplikat']).startswith('DUPLIKAT')]
byn = C.defaultdict(list)
for q in QK: byn[q['nrp']].append(q)
dbn = {r['nrp']: r for r in ALL}
QM = {}  # nrp -> q (matched to DB)
for n, lst in byn.items():
    if n not in dbn: continue
    best = max(lst, key=lambda q: difflib.SequenceMatcher(None, (q['Nama'] or '').lower(), dbn[n]['name'].lower()).ratio())
    QM[n] = best
S['q1Unmatched'] = sum(1 for n in byn if n not in dbn)
BID = [('KW', 'Kewirausahaan', 'KW'), ('MB', 'Minat Bakat', 'MB'), ('KI', 'Keilmiahan', 'K'), ('MN', 'Manajerial', 'M')]
TQ = [QM[r['nrp']] for r in T if r['nrp'] in QM]
FQ = [QM[r['nrp']] for r in ALL if r['nrp'] in QM]
TQV = [q for q in TQ if q['Valid Analisis'] == 1]
FQV = [q for q in FQ if q['Valid Analisis'] == 1]
S['q1'] = dict(resp=len(TQ), respF=len(FQ), valid=len(TQV), validF=len(FQV),
               straight=sum(1 for q in TQ if q['Straight-line'] == 'Ya'),
               dbK1=sum(1 for r in T if any(x['code'] == 'K1' and x['submitted'] for x in r['questionnaires'])),
               layakResp=sum(1 for r in TL if r['nrp'] in QM), notResp=sum(1 for r in nl if r['nrp'] in QM))
HI, STRONG, VHI = 3.0, 2, 3.5
q1b = []
for k, label, sk in BID:
    tv = [q[f'Minat {k}'] for q in TQV]; fv = [q[f'Minat {k}'] for q in FQV]
    lv = [q[f'Lv {k}'] or 0 for q in TQ]; lf = [q[f'Lv {k}'] or 0 for q in FQ]
    dom = sum(1 for q in TQV if label in str(q['Minat Dominan']))
    domF = sum(1 for q in FQV if label in str(q['Minat Dominan']))
    quad = C.Counter(q[f'Kuadran {k}'] for q in TQV); quadF = C.Counter(q[f'Kuadran {k}'] for q in FQV)
    q1b.append(dict(k=k, label=label, sk=sk, t=summ(tv), f=summ(fv), hi=sum(1 for x in tv if x >= HI) / len(tv),
                    rek1=sum(1 for x in lv if x >= 1) / len(lv), rek1F=sum(1 for x in lf if x >= 1) / len(lf),
                    rek2=sum(1 for x in lv if x >= STRONG) / len(lv), rek2F=sum(1 for x in lf if x >= STRONG) / len(lf),
                    rek3=sum(1 for x in lv if x >= 3) / len(lv),
                    dom=dom / len(TQV), domF=domF / len(FQV), domN=dom, quad=dict(quad), quadF=dict(quadF)))
S['q1b'] = q1b
S['q1tie'] = sum(1 for q in TQV if '+' in str(q['Minat Dominan'])) / len(TQV)
items_q = ['KW1', 'KW2', 'KW3', 'MB1', 'MB2', 'MB3', 'KI1', 'KI2', 'KI3', 'MN1', 'MN2', 'MN3']
ws2 = wb['Ringkasan FTEIC']
qtext = {}
for row in ws2.iter_rows(values_only=True):
    if row[0] and re.match(r'^(KW|MB|KI|MN)\d — ', str(row[0])):
        qtext[str(row[0])[:3]] = str(row[0]).split(' — ', 1)[1]
S['q1items'] = [dict(code=c, text=qtext.get(c, c), t=st.mean(q[c] for q in TQV), f=st.mean(q[c] for q in FQV),
                     agree=sum(1 for q in TQV if q[c] >= 3) / len(TQV)) for c in items_q]


def prio(q):
    return any((q[f'Minat {k}'] or 0) >= VHI and (q[f'Lv {k}'] or 0) >= STRONG for k, _, _ in BID) and q['Valid Analisis'] == 1


S['q1prio'] = sum(1 for q in TQV if prio(q)); S['q1prioF'] = sum(1 for q in FQV if prio(q))
S['q1prioBid'] = {label: sum(1 for q in TQV if (q[f'Minat {k}'] or 0) >= VHI and (q[f'Lv {k}'] or 0) >= STRONG)
                  for k, label, _ in BID}
S['q1rekom'] = {label: sum(1 for q in TQV if label in str(q['Rekomendasi Bidang'] or '')) for k, label, _ in BID}
S['q1rekomNone'] = sum(1 for q in TQV if not q['Rekomendasi Bidang'])
# reliability (Cronbach) per bidang on TI valid


def alpha(rows, ks):
    k = len(ks); var_items = sum(st.pvariance([q[x] for q in rows]) for x in ks)
    tot = st.pvariance([sum(q[x] for x in ks) for q in rows])
    return k / (k - 1) * (1 - var_items / tot)


S['q1alpha'] = {label: alpha(TQV, [f'{k}{i}' for i in (1, 2, 3)]) for k, label, _ in BID}
# cross: minat K1 vs mentor score per bidang (layak, valid)
cross = []
for k, label, sk in BID:
    pairs = [(QM[r['nrp']][f'Minat {k}'], next(c for c in r['skillDetail'] if c['code'] == sk)['mentorScore'])
             for r in TL if r['nrp'] in QM and QM[r['nrp']]['Valid Analisis'] == 1
             and not any(i['origin'] == 'KOSONG' for i in r['skillItems'])]
    rho, p = sps.spearmanr([a for a, b in pairs], [b for a, b in pairs])
    hi = [b for a, b in pairs if a >= HI]; lo = [b for a, b in pairs if a < HI]
    cross.append(dict(label=label, n=len(pairs), rho=rho, p=p, hi=st.mean(hi) if hi else None,
                      lo=st.mean(lo) if lo else None, nhi=len(hi), nlo=len(lo)))
S['cross'] = cross
# NP comparison respondents vs non
S['npResp'] = summ([r['personal'] for r in TL if r['nrp'] in QM])
S['npNoResp'] = summ([r['personal'] for r in TL if r['nrp'] not in QM])
for r in T: r['_q1'] = QM.get(r['nrp'])

# ---------- pendampingan ----------
flags = [r for r in T if r['flags']]
IPF_FAIL = {}
if len(sys.argv) > 4:
    _iw = openpyxl.load_workbook(sys.argv[4], data_only=True)['TIDAK LULUS']
    IPF_FAIL = {str(x[1]): x[2] for x in _iw.iter_rows(min_row=2, values_only=True) if x[1]}
S['ipfFail'] = sorted([[r['name'], r['nrp']] for r in T if r['nrp'] in IPF_FAIL], key=lambda x: x[1])
crit = [
    ('Tidak layak diagregasi', 'Alpa Temu FTEIC lebih dari 2 kali atau alpa Kegiatan Besar lebih dari 3 kali', [r for r in nl],
     'Konfirmasi status keaktifan akademik, kemudian pendekatan personal oleh pengurus HMD'),
    ('Nilai Personal rendah', 'Layak diagregasi dengan Nilai Personal di bawah 70', [r for r in TL if r['personal'] < 70],
     'Tinjau komponen yang rendah (kehadiran atau penilaian materi) bersama Maba yang bersangkutan'),
    ('Nilai Keahlian rendah', 'Layak diagregasi dengan Nilai Keahlian di bawah 70', [r for r in TL if (r['skill'] or 0) < 70],
     'Arahkan ke kegiatan keahlian sesuai bidang yang diminati'),
    ('Evaluasi mentor belum lengkap', 'Evaluasi logbook keahlian oleh mentor tidak tersedia', [r for r in T if any(i['origin'] == 'KOSONG' for i in r['skillItems'])],
     'Verifikasi data kepada mentor unit melalui PSDM'),
    ('Catatan khusus mentor', 'Terdapat laporan khusus dari mentor pada sistem', flags,
     'Klarifikasi kepada PSDM sebelum tindak lanjut; ditangani secara tertutup'),
    ('Tidak mengisi Kuesioner 1', 'Tidak tercatat sebagai responden Kuesioner 1 (baseline)', [r for r in T if r['nrp'] not in QM],
     'Pemetaan minat dilakukan melalui wawancara singkat atau formulir HMD'),
    ('Tidak Lulus IPF (Inclenation)', 'Tidak hadir dalam rangkaian IPF dan nilai pengembangan di bawah 30', [r for r in T if r['nrp'] in IPF_FAIL],
     'Menyarankan untuk mengikuti IPF tahun depan, dikarenakan sertifikat IPF wajib sebagai syarat yudisium'),
]
S['crit'] = [dict(name=a, defn=b, n=len(c), step=e) for a, b, c, e in crit]
S['critUnion'] = len({r['nrp'] for k, (a, _, c, _) in enumerate(crit) if a != 'Tidak mengisi Kuesioner 1' for r in c})
for r in T:
    r['_crit'] = [a for a, b, c, e in crit if r in c]
seg = C.Counter()
for r in TL:
    p, k = pred(r['personal']), pred(r['skill'])
    if p == 'SB' and k == 'SB': seg['both'] += 1
    elif r['personal'] < 70 or (r['skill'] or 0) < 70: seg['low'] += 1
    elif p == 'SB' or k == 'SB': seg['one'] += 1
    else: seg['mid'] += 1
S['seg'] = dict(seg)


# ---------- K1 vs GRADAKS ----------
BIDMAP = [('KW', 'Kewirausahaan', 'KW'), ('MB', 'Minat Bakat', 'MB'), ('KI', 'Keilmiahan', 'K'), ('MN', 'Manajerial', 'M')]
cmpc = C.Counter(); perbid = []
for r in T:
    q = r['_q1']
    empty = any(i['origin'] == 'KOSONG' for i in r['skillItems'])
    ms = {c['code']: c['mentorScore'] for c in r['skillDetail']}
    g_top = None; k_top = None
    if not empty:
        mx = max(ms.values()); g_top = [lab for k, lab, sk in BIDMAP if abs(ms[sk] - mx) < 1e-9]
    if q and q['Valid Analisis'] == 1:
        k_top = [lab for k, lab, sk in BIDMAP if lab in str(q['Minat Dominan'])]
    if not q or q['Valid Analisis'] != 1 or empty: cat = 'Tidak dapat dibandingkan'
    elif len(g_top) == 4: cat = 'Penilaian GRADAKS seimbang di semua bidang'
    elif set(g_top) & set(k_top): cat = 'Sesuai'
    else: cat = 'Berbeda'
    r['_cmp'] = cat; r['_gtop'] = g_top; r['_ktop'] = k_top
    cmpc[cat] += 1
S['cmp'] = dict(cmpc)
for k, lab, sk in BIDMAP:
    both = [r for r in T if r['_q1'] and r['_q1']['Valid Analisis'] == 1 and not any(i['origin'] == 'KOSONG' for i in r['skillItems'])]
    hiK = [r for r in both if r['_q1'][f'Minat {k}'] >= 3.0]
    sbG = [r for r in both if next(c for c in r['skillDetail'] if c['code'] == sk)['mentorScore'] >= 85]
    ungK = [r for r in both if r['_q1'][f'Kuadran {k}'] == 'Unggulan']
    perbid.append(dict(label=lab, n=len(both), hiK=len(hiK), sbG=len(sbG), bothHi=len(set(x['nrp'] for x in hiK) & set(x['nrp'] for x in sbG)),
                       ungK=len(ungK), ungKsbG=len(set(x['nrp'] for x in ungK) & set(x['nrp'] for x in sbG)),
                       domK=sum(1 for r in both if r['_ktop'] and lab in r['_ktop']),
                       topG=sum(1 for r in both if r['_gtop'] and lab in r['_gtop'] and len(r['_gtop']) < 4)))
S['cmpBid'] = perbid
S['cmpN'] = len([r for r in T if r['_cmp'] != 'Tidak dapat dibandingkan'])

# ---------- mentor angkatan 2025 ----------
MX = sys.argv[3] if len(sys.argv) > 3 else None
S['mentors'] = []
if MX:
    mwb = openpyxl.load_workbook(MX, data_only=True)
    ra = [x for x in mwb['REKAP ALL'].iter_rows(min_row=2, values_only=True) if x[0] == DEPT_NAME]
    hdr7 = [c.value for c in mwb['Rekap 7 Sesi'][2]]
    sess7 = hdr7[3:10]
    rows7 = {str(x[0]): x for x in mwb['Rekap 7 Sesi'].iter_rows(min_row=4, values_only=True) if x[0]}
    du = list(mwb['Data user'].iter_rows(values_only=True))
    idmap = {str(x[1]): x[0] for x in du[1:]}
    keh = list(mwb['Kehadiran'].iter_rows(min_row=2, values_only=True))
    munit = {m['nrp']: (m['unit'] or {}).get('code') for m in d['mentors'] if m['nrp']}
    for x in ra:
        nrp = str(x[1]); st7 = list(rows7[nrp][3:10]) if nrp in rows7 else [None] * 7
        ps = [k[4] for k in keh if k[1] == idmap.get(nrp) and isinstance(k[4], (int, float))]
        u = munit.get(nrp); uu = units.get(u, {}) if u else {}
        nmaba = sum(1 for r in ALL if r['unitCode'] == u); nti = sum(1 for r in T if r['unitCode'] == u)
        h = st7.count('HADIR'); i_ = st7.count('IZIN'); a = st7.count('ALPA'); tc = sum(1 for v in st7 if v is None)
        S['mentors'].append(dict(nrp=nrp, name=x[2], unit=f"{uu.get('name', '-')} ({u})" if u else '-', region=(uu.get('region') or {}).get('name', '-'),
                                 nmaba=nmaba, nti=nti, status=st7, H=h, I=i_, A=a, TC=tc,
                                 pct=h / (7 - tc) if 7 - tc else None, pct7=h / 7, keaktifan=st.mean(ps) if ps else None))
    S['mentorSess'] = [str(s_).replace('\u2014', '-') for s_ in sess7]
    S['mentors'].sort(key=lambda m: m['name'].lower())

json.dump(S, open(f'{BASE}/work/stats_{DEPT}.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1, default=str)
json.dump({'T': T, 'SESS': SESS, 'KL': KL}, open(f'{BASE}/work/rows_{DEPT}.json', 'w', encoding='utf8'), ensure_ascii=False, default=str)
print('ok', len(T))
