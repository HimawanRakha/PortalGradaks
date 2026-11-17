"""Laporan pengembangan Maba untuk HMD (versi sederhana, fokus departemen)."""
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'docx_helpers.py'), encoding='utf8').read())

# ---------------- derived values ----------------
nT, nTL, nTn = S['nT'], S['nTL'], S['nTnot']
held = [s for s in S['sessions'] if s['held']]
NH = len(held)
att = S['attTot']
comp = {c['code']: c for c in S['components']}
sub = {s['code']: s for s in S['subnilai']}
skc = {c['code']: c for c in S['skillcat']}
low_sess = [s for s in held if s['pctH'] < 0.5]
temu = [s for s in held if s['cat'] == 'TEMU_FTEIC']
incl = [s for s in held if s['cat'] == 'INCLENATION']
mat_sub = [s for s in S['subnilai'] if s['code'] != 'A.1']
mat_low = min(mat_sub, key=lambda s: s['t']['mean'])
mat_high = max(mat_sub, key=lambda s: s['t']['mean'])
skm_sorted = sorted(S['skillcat'], key=lambda c: c['mentor']['mean'])
items = S['items']
def items_of(code): return [i for i in items if code in i['targets'].split(',')]
def low_item(code): return min(items_of(code), key=lambda i: i['mean'])
q1 = S['q1']
q1_sorted = sorted(S['q1b'], key=lambda b: b['t']['mean'])
ppd, kpd = S['personal']['pd'], S['skill']['pd']
pt, kt = S['personal']['t'], S['skill']['t']
keah_any = S['keahlianAny']
seg = S['seg']
cmp_ = S['cmp']
lat = max(S['q1b'], key=lambda b: b['quad'].get('Laten', 0))
ung = max(S['q1b'], key=lambda b: b['quad'].get('Unggulan', 0))
mentors = S['mentors']
low_names = ', '.join(s['nice'] for s in low_sess)
LINK_MABA = f"Data_Mentah_Maba_{DN.replace(' ', '_')}_2026.xlsx"
LINK_MENTOR = f"Rekap_Mentor_{DN.replace(' ', '_')}.xlsx"
tb = S['topBidang']
def nice_name(s): return s.title() if any(w.islower() for w in s.split()) else s
cmp_valid = cmp_.get('Sesuai', 0) + cmp_.get('Berbeda', 0)
_nb, _bo = S['notBesar'], S['notBoth']
BESAR_TXT = (f'Seluruh Maba yang tidak layak diagregasi melampaui batas alpa Kegiatan Besar, dan {n(_bo)} di antaranya juga melampaui batas alpa Temu FTEIC.' if _nb == nTn else
             f'Sebanyak {n(_nb)} dari {n(nTn)} Maba yang tidak layak diagregasi melampaui batas alpa Kegiatan Besar dan {n(S["notTemu"])} Maba melampaui batas alpa Temu FTEIC, dengan {n(_bo)} Maba melampaui keduanya.')
REL_TXT = 'lemah' if max(abs(c['rho']) for c in S['cross']) < 0.3 else 'lemah hingga sedang'
low_besar = [s for s in low_sess if s['cat'] == 'KEGIATAN_BESAR']
low_other = [s for s in held if s['cat'] != 'KEGIATAN_BESAR' and s['pctH'] < 0.7]
cmp_comp = sum(v for k, v in cmp_.items() if k != 'Tidak dapat dibandingkan')

# ---- cover: nama departemen dan logo
for par in doc.paragraphs:
    if par.text.strip() == 'LAPORAN KEGIATAN':
        np_el = copy.deepcopy(par._p); par._p.addnext(np_el)
        for t in np_el.iter(qn('w:t')): t.text = ''
        list(np_el.iter(qn('w:t')))[0].text = DN.upper()
    if par.text.strip() == '(GRADAKS × ONE DATA)':
        sp = par._p.pPr.find(qn('w:spacing')); sp.set(qn('w:after'), '120')
        lp = doc.add_paragraph(); lp.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        lp.paragraph_format.space_after = Pt(6)
        lp.add_run().add_picture(os.path.join(BASE, 'work', 'logo_bem.png'), width=Cm(8.5))
        par._p.addnext(lp._p)
        break

# ======================================================================
H('KATA PENGANTAR', 1)
P(f'Puji syukur ke hadirat Tuhan Yang Maha Esa atas terselesaikannya rangkaian Pengembangan Mahasiswa Baru FTEIC ITS 2026 (GRADAKS × One Data). Laporan ini disusun oleh Departemen Pengembangan Sumber Daya Mahasiswa (PSDM) BEM FTEIC ITS sebagai bahan serah terima data kepada Himpunan Mahasiswa Departemen (HMD) {DN}.')
P(f'Laporan ini berisi empat hal yang dibutuhkan HMD untuk melanjutkan kaderisasi, yaitu peminatan Maba, nilai Maba, data potensi Maba, dan data Maba yang perlu ditinjau. Laporan juga memuat data kehadiran mentor angkatan 2025 dari Departemen {DN}. Seluruh angka diolah dari basis data Portal GRADAKS per {DATE}, setelah masa sanggah raport berakhir, serta dari hasil olahan Kuesioner 1.')
P('Kami berharap laporan ini dapat dimanfaatkan secara bertanggung jawab sebagai dasar pembinaan mahasiswa baru di lingkungan HMD.')
P(f'Surabaya, {DATE}', align='r', before=12, after=2)
P('Departemen Pengembangan Sumber Daya Mahasiswa', align='r', after=2)
P('BEM FTEIC ITS Kabinet Pola Harmonis', align='r')

# ======================================================================
CHAP('RINGKASAN')
P(f'Departemen {DN} memiliki {n(nT)} mahasiswa baru angkatan 2026 yang mengikuti rangkaian GRADAKS sejak Inclenation pada 18–19 Agustus 2026. Tabel berikut merangkum angka-angka utama dalam laporan ini.')
CAP_T('Angka Utama')
TABLE(['Indikator', 'Hasil'], [
    ['Jumlah Maba', n(nT)],
    ['Maba layak diagregasi', np_(nTL, nT)],
    [f'Rata-rata kehadiran pada {NH} sesi wajib', p(att['H'] / att['slots'])],
    ['Rata-rata Nilai Personal', f1(pt['mean'])],
    ['Rata-rata Nilai Keahlian', f1(kt['mean'])],
    ['Bidang paling diminati (Kuesioner 1)', f'{q1_sorted[-1]["label"]} dan {q1_sorted[-2]["label"]}'],
    ['Kandidat prioritas (minat sangat tinggi dan rekam jejak kuat)', f'{n(S["q1prio"])} Maba'],
    [f'Mentor angkatan 2025 dari {DN}', f'{n(len(mentors))} orang'],
], [10.2, 6.0], ['l', 'c'])
P('Hal-hal penting yang perlu diketahui HMD:', after=4, keep=True)
LIST([
    f'**Nilai.** Sebagian besar Maba memperoleh Nilai Personal berpredikat Sangat Baik ({p(ppd["SB"][1])}) atau Baik ({p(ppd["B"][1])}). Nilai Keahlian lebih beragam karena baru {p(keah_any / nT)} Maba yang mengikuti Kegiatan Keahlian.',
    f'**Peminatan.** Maba paling banyak berminat pada {q1_sorted[-1]["label"]} dan {q1_sorted[-2]["label"]}. Minat terendah ada pada {q1_sorted[0]["label"]}.',
    f'**Potensi.** Bidang {ung["label"]} memiliki Maba Unggulan terbanyak ({n(ung["quad"].get("Unggulan", 0))} orang). Bidang {lat["label"]} memiliki Maba Laten terbanyak ({n(lat["quad"].get("Laten", 0))} orang), yaitu Maba yang berminat tetapi belum berpengalaman.',
    f'**Perlu ditinjau.** Sebanyak {n(nTn)} Maba tidak layak diagregasi, terutama karena banyak alpa pada Kegiatan Besar, dan {n(S["notNoTemu"])} di antaranya tidak pernah hadir di Temu FTEIC.',
])

# ======================================================================
CHAP('MEMAHAMI DATA DAN NILAI GRADAKS')
P('Bagian ini menjelaskan dari mana setiap nilai berasal dan bagaimana nilai tersebut diolah. Pemahaman ini penting agar HMD dapat membaca angka pada bagian-bagian berikutnya dengan tepat.')
SEC(1, 'Dari Mana Nilai Berasal')
P('Nilai GRADAKS tidak berasal dari satu tes, melainkan dari beberapa sumber yang dikumpulkan selama rangkaian berlangsung. Setiap sumber diisi oleh pihak yang berbeda dan memiliki skala sendiri.')
CAP_T('Sumber Data (Input) GRADAKS')
TABLE(['Input', 'Diisi oleh', 'Skala', 'Digunakan untuk'], [
    ['Presensi sesi', 'Mentor / panitia', 'Hadir, Izin, Alpa', 'Skor kehadiran dan status agregasi'],
    ['Rubrik penilaian materi', 'Mentor', '1–4', 'Sub-nilai A.2, B.1, B.2, C.1, C.2'],
    ['Kuis dan penugasan kelompok', 'Sistem / panitia', '0–100 atau 1–4', 'Sub-nilai terkait materi'],
    ['Keaktifan sesi', 'Mentor', '1–4', 'Sub-nilai Kerja Sama dan Problem Solving'],
    ['Evaluasi logbook keahlian', 'Mentor', '1–4 (keaktifan, minat, potensi)', 'Nilai Keahlian (80%)'],
    ['Kegiatan Keahlian', 'Panitia kegiatan', 'Ikut / tidak ikut', 'Nilai Keahlian (20%)'],
    ['Penilaian Manajerial', 'Panitia', '0–100', 'Bidang Manajerial (20%)'],
    ['Kuesioner 1', 'Maba sendiri', 'Likert 1–4 dan isian', 'Peta peminatan dan potensi'],
    ['Tes MBTI', 'Maba sendiri', 'Tipe kepribadian', 'Gambaran gaya (tidak dinilai)'],
], [4.2, 3.0, 3.6, 5.4], ['l', 'l', 'l', 'l'])
P('Gambar berikut menunjukkan alur pengolahan dari input menjadi hasil akhir.')
IMG(FIG + 'flow.png', 15.5)
CAP_F('Alur Pengolahan Nilai GRADAKS')
P('Prosesnya dapat diringkas dalam empat langkah. Pertama, setiap nilai mentah diubah ke skala 0–100 agar dapat dibandingkan, misalnya nilai rubrik 3 dari 4 menjadi 75. Kedua, nilai-nilai tersebut dirata-rata per sub-nilai atau per bidang. Ketiga, sub-nilai digabungkan dengan bobot tertentu menjadi Nilai Personal dan Nilai Keahlian. Keempat, nilai akhir diberi predikat dan setiap Maba diberi status agregasi berdasarkan kehadirannya.')

SEC(2, 'Nilai Personal')
P('Nilai Personal menggambarkan keterlibatan dan perkembangan karakter Maba selama rangkaian. Nilai ini terdiri atas dua bagian, yaitu kehadiran (60%) dan Penilaian Materi (40%). Kehadiran diberi porsi besar agar Maba yang jarang hadir tidak dapat memperoleh nilai tinggi hanya dari penilaian mentor.')
CAP_T('Komponen Nilai Personal')
TABLE(['Komponen', 'Bobot', 'Cara menghitung'], [
    ['Kehadiran Temu FTEIC', '25%', 'Rata-rata skor kehadiran 5 sesi Temu FTEIC (Hadir 100, Izin 50, Alpa 0)'],
    ['Kehadiran Kegiatan Besar', '25%', 'Rata-rata skor kehadiran Pesraf, Soscom, Arus Emas 1–3, dan Compex'],
    ['Kehadiran Inclenation', '10%', 'Rata-rata skor kehadiran Inclenation hari 1 dan 2'],
    ['Penilaian Materi', '40%', 'Gabungan enam sub-nilai dengan bobot AHP (lihat tabel berikut)'],
], [4.6, 1.6, 10.0], ['l', 'c', 'l'])
P('Penilaian Materi terdiri atas enam sub-nilai yang dikelompokkan ke dalam tiga nilai besar, yaitu Kolektif, Kolaboratif, dan Kontributif. Bobot setiap sub-nilai ditentukan dengan metode Analytic Hierarchy Process (AHP), yaitu metode penentuan bobot berdasarkan perbandingan tingkat kepentingan antaraspek.')
CAP_T('Pengertian Sub-Nilai Penilaian Materi')
TABLE(['Kode', 'Sub-nilai', 'Pengertian', 'Sumber penilaian', 'Bobot'], [
    ['A.1', 'Kebersamaan', 'Keterlibatan Maba dalam kegiatan bersama', 'Rasio kehadiran seluruh sesi wajib', '2,00%'],
    ['A.2', 'Kebanggaan Fakultas', 'Pemahaman dan rasa memiliki terhadap FTEIC', 'Rubrik materi Wawasan FTEIC', '37,87%'],
    ['B.1', 'Manajemen Diri', 'Kemampuan mengenal, mengatur, dan memotivasi diri', 'Rubrik materi Know Who You Are, Berani Menjadi Berbeda, Win Urself Win Everything', '26,09%'],
    ['B.2', 'Kerja Sama', 'Kemampuan berkomunikasi dan bekerja dalam tim', 'Rubrik Public Speaking, Jangan Asal Debat, dan keaktifan sesi', '17,55%'],
    ['C.1', 'Problem Solving', 'Kemampuan berpikir kritis dan kreatif', 'Rubrik berpikir kritis, kreativitas, SWOT, dan keaktifan sesi', '11,72%'],
    ['C.2', 'Kepekaan Sosial', 'Kepedulian dan kemampuan menjalin hubungan', 'Rubrik How to Win Friends, Be Proactive, dan Soscom', '4,76%'],
], [1.1, 2.8, 4.4, 6.2, 1.7], ['c', 'l', 'l', 'l', 'c'], size=9)

SEC(3, 'Nilai Keahlian')
P('Nilai Keahlian menggambarkan minat, keaktifan, dan potensi Maba pada empat bidang pengembangan. Nilai setiap bidang terdiri atas 80% evaluasi mentor dan 20% komponen kegiatan. Nilai Keahlian adalah rata-rata dari keempat bidang tersebut.')
CAP_T('Pengertian Bidang Keahlian')
TABLE(['Bidang', 'Pengertian', 'Komponen kegiatan (20%)'], [
    ['Manajerial', 'Kepemimpinan, pengorganisasian, dan pengelolaan kegiatan', 'Hasil Penilaian Manajerial (0–100)'],
    ['Keilmiahan', 'Penalaran, riset, karya tulis, dan kompetisi akademik', 'Ikut Club Development atau IBM X Hacktiv'],
    ['Minat Bakat', 'Seni, olahraga, kreativitas, dan hobi', 'Ikut Community Life atau Diesnatalis'],
    ['Kewirausahaan', 'Peluang usaha, bisnis, dan pengelolaan keuangan', 'Ikut Entrepreneur Gathering atau Sekolah Bisnis'],
], [3.0, 7.0, 6.2], ['l', 'l', 'l'])
P('Evaluasi mentor diberikan berdasarkan logbook Maba dengan tiga aspek pada setiap bidang, yaitu keaktifan, minat, dan potensi, masing-masing pada skala 1–4. Komponen kegiatan bernilai 100 apabila Maba mengikuti sedikitnya satu Kegiatan Keahlian pada bidang tersebut dan 0 apabila tidak. Karena Kegiatan Keahlian bersifat pilihan, kolom **evaluasi mentor** lebih tepat digunakan untuk melihat kecenderungan bidang seorang Maba.')

SEC(4, 'Predikat dan Status Agregasi')
P('Setiap nilai diberi predikat agar mudah dibaca, yaitu **Sangat Baik** (85 ke atas), **Baik** (70–84,9), **Cukup** (55–69,9), dan **Kurang** (di bawah 55).')
P('Selain predikat, setiap Maba memiliki status agregasi. Maba disebut **layak diagregasi** apabila alpa pada Temu FTEIC tidak lebih dari 2 kali dan alpa pada Kegiatan Besar tidak lebih dari 3 kali. Izin tidak dihitung sebagai alpa. Status ini hanya menandai apakah data seorang Maba cukup lengkap untuk dihitung dalam statistik angkatan. Status **tidak layak diagregasi** bukan sanksi dan bukan kegagalan; nilai Maba tetap dihitung, Maba tetap menerima raport, dan datanya diserahkan kepada HMD untuk pendampingan lanjutan. Rata-rata nilai pada laporan ini dihitung dari Maba yang layak diagregasi.')

SEC(5, 'Peminatan dan Potensi dari Kuesioner 1')
P('Kuesioner 1 diisi Maba pada awal rangkaian (Temu FTEIC 0). Kuesioner ini memuat dua bagian. Bagian pertama berisi 12 pernyataan minat (tiga pernyataan untuk setiap bidang) yang dijawab dengan skala 1 (sangat tidak setuju) sampai 4 (sangat setuju). Rata-rata ketiga jawaban menjadi **skor minat** bidang tersebut; skor 3,00 ke atas disebut **minat tinggi**. Bidang dengan skor minat tertinggi disebut **minat dominan**.')
P('Bagian kedua berisi isian pengalaman (rekam jejak) Maba pada setiap bidang yang kemudian dikelompokkan ke dalam empat level.')
CAP_T('Level Rekam Jejak')
TABLE(['Level', 'Arti', 'Contoh'], [
    ['0', 'Belum ada pengalaman', 'Isian kosong atau "tidak ada"'],
    ['1', 'Pernah terlibat', 'Peserta lomba, anggota organisasi'],
    ['2', 'Berprestasi atau memegang peran inti', 'Juara, finalis, ketua divisi, sekretaris, bendahara'],
    ['3', 'Prestasi atau peran puncak tingkat tinggi', 'Juara provinsi/nasional, Ketua OSIS, ketua pelaksana, pendiri usaha'],
], [1.5, 6.0, 8.7], ['c', 'l', 'l'])
P('Gabungan skor minat dan level rekam jejak menghasilkan **kuadran potensi** pada setiap bidang.')
CAP_T('Kuadran Potensi')
TABLE(['Kuadran', 'Minat', 'Rekam jejak', 'Makna bagi HMD'], [
    ['Unggulan', 'Tinggi', 'Kuat (level 2–3)', 'Siap diberi peran dan tanggung jawab'],
    ['Berkembang', 'Tinggi', 'Awal (level 1)', 'Perlu kesempatan untuk naik level'],
    ['Laten', 'Tinggi', 'Belum ada (level 0)', 'Berminat tetapi belum pernah mencoba; sasaran undangan pertama'],
    ['Pasif', 'Rendah', 'Ada', 'Berpengalaman tetapi minatnya menurun; perlu ditanya alasannya'],
    ['Rendah', 'Rendah', 'Belum ada', 'Bukan prioritas pada bidang tersebut'],
], [2.6, 2.0, 3.2, 8.4], ['l', 'c', 'c', 'l'])
P('Maba disebut **kandidat prioritas** apabila memiliki skor minat sangat tinggi (3,50 ke atas) dan rekam jejak kuat (level 2 ke atas) pada sedikitnya satu bidang yang sama.')

SEC(6, 'Perbedaan Kuesioner 1 dan Penilaian GRADAKS')
P('Laporan ini memetakan minat dan potensi Maba dari dua sumber yang berbeda sifatnya. Keduanya tidak saling menggantikan, tetapi saling melengkapi.')
CAP_T('Perbandingan Dua Sumber Pemetaan')
TABLE(['Aspek', 'Kuesioner 1', 'Penilaian GRADAKS'], [
    ['Siapa yang menilai', 'Maba menilai dirinya sendiri', 'Mentor menilai Maba'],
    ['Waktu', 'Awal rangkaian (Temu FTEIC 0)', 'Akhir rangkaian (Temu FTEIC 3)'],
    ['Dasar penilaian', 'Pernyataan minat dan pengalaman sebelum kuliah', 'Pengamatan selama rangkaian dan isi logbook'],
    ['Yang diukur', 'Keinginan dan rekam jejak', 'Keaktifan, minat, dan potensi yang terlihat'],
    ['Kelebihan', 'Menangkap keinginan pribadi Maba', 'Berdasarkan perilaku nyata selama kegiatan'],
    ['Keterbatasan', 'Bisa dipengaruhi cara Maba menilai diri', 'Bergantung pada pengamatan dan ketelitian mentor'],
], [3.6, 6.3, 6.3], ['l', 'l', 'l'])

# ======================================================================
CHAP('GAMBARAN UMUM MABA')
SEC(1, 'Jumlah dan Sebaran')
P(f'Maba {DN} berjumlah {n(nT)} orang yang berasal dari ' + ', '.join(f'kode program studi {k} ({n(v)} Maba)' for k, v in S['prodi']) + f'. Mereka tersebar pada {S["nRegions"]} region dan {S["nUnits"]} unit mentoring, dengan rata-rata {f1(S["unitSizes"]["mean"])} Maba {DN} per unit. Rekap per unit tersedia pada berkas data mentah.')
SEC(2, 'Kehadiran')
P(f'Maba mengikuti {NH} sesi wajib, yaitu {len(incl)} hari Inclenation, {len(temu)} sesi Temu FTEIC, dan {NH - len(incl) - len(temu)} Kegiatan Besar. Secara keseluruhan tercatat {p(att["H"] / att["slots"])} kehadiran, {p(att["I"] / att["slots"])} izin, dan {p(att["A"] / att["slots"])} alpa. Rata-rata seorang Maba hadir pada {f1(S["meanHadir"])} dari {NH} sesi.')
IMG(FIG + 'att.png', 15.0)
CAP_F('Persentase Maba Hadir pada Setiap Sesi')
_core = [s for s in incl + temu if s not in low_other]
P(f'Kehadiran pada Inclenation dan Temu FTEIC tinggi, yaitu di atas {p(min(s["pctH"] for s in _core), 0)}' + (f', kecuali {", ".join(s["nice"] for s in low_other)} ({", ".join(p(s["pctH"]) for s in low_other)})' if low_other else '') + '.' + (f' Kehadiran terendah terjadi pada {", ".join(s["nice"] for s in low_besar)} ({", ".join(p(s["pctH"]) for s in low_besar)}). Karena kegiatan tersebut termasuk Kegiatan Besar, rendahnya kehadiran ini menjadi penyebab utama Maba tidak layak diagregasi.' if low_besar else ''))
SEC(3, 'Status Agregasi')
IMG(FIG + 'status.png', 15.0)
CAP_F('Status Agregasi dan Jumlah Alpa Maba')
P(f'Sebanyak {np_(nTL, nT)} Maba layak diagregasi dan {np_(nTn, nT)} Maba tidak layak diagregasi. {BESAR_TXT} Sebanyak {n(S["notNoTemu"])} Maba tidak pernah menghadiri satu pun sesi Temu FTEIC.')

# ======================================================================
CHAP('NILAI MABA')
P(f'Rata-rata pada bagian ini dihitung dari {n(nTL)} Maba layak diagregasi. Nilai setiap Maba, termasuk yang tidak layak diagregasi, tersedia pada sheet Nilai Maba dalam berkas data mentah.')
SEC(1, 'Nilai Personal dan Nilai Keahlian')
CAP_T('Ringkasan Nilai Akhir')
TABLE(['Nilai', 'Rata-rata', 'Nilai tengah (median)', 'Terendah', 'Tertinggi'], [
    ['Nilai Personal', f1(pt['mean']), f1(pt['median']), f1(pt['min']), f1(pt['max'])],
    ['Nilai Keahlian', f1(kt['mean']), f1(kt['median']), f1(kt['min']), f1(kt['max'])],
], [4.6, 2.8, 3.4, 2.7, 2.7])
IMG(FIG + 'pred.png', 15.0)
CAP_F('Sebaran Predikat Nilai Personal dan Nilai Keahlian')
P(f'Nilai Personal Maba {DN} umumnya tinggi: {p(ppd["SB"][1])} berpredikat Sangat Baik dan {p(ppd["B"][1])} Baik. Nilai Keahlian lebih beragam, dengan {p(kpd["SB"][1] + kpd["B"][1])} berpredikat Sangat Baik atau Baik dan {p(kpd["C"][1] + kpd["K"][1])} Cukup atau Kurang. Nilai Keahlian yang lebih rendah sebagian besar disebabkan oleh komponen kegiatan, karena {np_(nT - keah_any, nT)} Maba belum mengikuti Kegiatan Keahlian.')
SEC(2, 'Nilai per Sub-Nilai')
IMG(FIG + 'sub.png', 15.0)
CAP_F('Rata-rata Sub-Nilai Penilaian Materi')
lb2 = low_item('B.2'); lc1 = low_item('C.1')
P(f'Sub-nilai tertinggi adalah {mat_high["label"]} ({f1(mat_high["t"]["mean"])}) dan yang terendah di antara sub-nilai materi adalah {mat_low["label"]} ({f1(mat_low["t"]["mean"])}). Kebersamaan (A.1) tampak lebih rendah ({f1(sub["A.1"]["t"]["mean"])}) karena dihitung langsung dari kehadiran pada seluruh sesi wajib, termasuk Kegiatan Besar yang kehadirannya rendah.')
P(f'Butir penilaian yang paling perlu diperkuat adalah {lb2["label"]} ({f1(lb2["mean"])}) pada Kerja Sama dan {lc1["label"]} ({f1(lc1["mean"])}) pada Problem Solving. Kedua butir ini dapat menjadi fokus pembinaan HMD, misalnya melalui presentasi bergilir dan proyek kolaboratif.')
SEC(3, 'Nilai per Bidang Keahlian')
IMG(FIG + 'skill.png', 14.5)
CAP_F('Evaluasi Mentor dan Nilai Bidang Keahlian')
CAP_T('Nilai Bidang Keahlian')
TABLE(['Bidang', 'Evaluasi mentor', 'Komponen kegiatan', 'Nilai bidang (raport)', '% Sangat Baik'],
      [[c['label'], f1(c['mentor']['mean']), f1(c['keg']['mean']), f1(c['t']['mean']), p(c['pd']['SB'][1])] for c in S['skillcat']],
      [3.6, 3.0, 3.2, 3.4, 3.0])
P(f'Menurut evaluasi mentor, bidang tertinggi adalah {skm_sorted[-1]["label"]} ({f1(skm_sorted[-1]["mentor"]["mean"])}) dan terendah {skm_sorted[0]["label"]} ({f1(skm_sorted[0]["mentor"]["mean"])}). Nilai bidang pada raport lebih rendah daripada evaluasi mentor karena komponen kegiatannya. Bidang Manajerial paling sedikit turun karena komponen kegiatannya berasal dari Penilaian Manajerial (rata-rata {f1(S["manajerialRaw"]["mean"])}), bukan dari keikutsertaan kegiatan pilihan.')

SEC(4, 'Rapor Individu Maba')
P('Setiap mahasiswa baru mendapatkan rapor individu yang menjadi bentuk transparansi dan bahan evaluasi bagi pribadi masing-masing beserta rekomendasinya. Maba yang tidak layak diagregasi tidak mendapatkan rekomendasi.')
IMG(os.path.join(BASE, 'work', 'rapor_contoh.png'), 9.3)

# ======================================================================
CHAP('PEMINATAN MABA')
P(f'Peminatan diambil dari Kuesioner 1. Sebanyak {np_(q1["resp"], nT)} Maba mengisi kuesioner ini. Sebanyak {n(q1["straight"])} responden menjawab seluruh pernyataan dengan angka yang sama sehingga tidak diikutkan dalam perhitungan skor minat. Dengan demikian, analisis peminatan menggunakan {n(q1["valid"])} responden.')
SEC(1, 'Minat per Bidang')
IMG(FIG + 'minat.png', 10.5)
CAP_F('Skor Minat per Bidang')
CAP_T('Peminatan per Bidang')
TABLE(['Bidang', 'Rata-rata skor minat (1–4)'], [[b['label'], f2(b['t']['mean'])] for b in S['q1b']], [4.2, 3.6])
P(f'Bidang yang paling diminati adalah {q1_sorted[-1]["label"]} ({f2(q1_sorted[-1]["t"]["mean"])}) dan {q1_sorted[-2]["label"]} ({f2(q1_sorted[-2]["t"]["mean"])}), sedangkan yang paling rendah adalah {q1_sorted[0]["label"]} ({f2(q1_sorted[0]["t"]["mean"])}).')
qi = sorted(S['q1items'], key=lambda x: x['t'])
P(f'Pernyataan yang paling disetujui Maba adalah "{qi[-1]["text"]}" (rata-rata {f2(qi[-1]["t"])}). Pernyataan yang paling sedikit disetujui adalah "{qi[0]["text"]}" (rata-rata {f2(qi[0]["t"])}).')
SEC(2, 'Rekam Jejak')
CAP_T('Rekam Jejak Maba per Bidang')
TABLE(['Bidang', '% Maba pernah terlibat (level 1–3)', '% Maba berprestasi atau peran inti (level 2–3)'],
      [[b['label'], p(b['rek1']), p(b['rek2'])] for b in S['q1b']], [4.6, 5.8, 5.8])
rk = sorted(S['q1b'], key=lambda b: b['rek1'])
P(f'Pengalaman Maba paling banyak berada pada bidang {rk[-1]["label"]} dan {rk[-2]["label"]}, sedangkan paling sedikit pada bidang {rk[0]["label"]}. Teks asli isian rekam jejak setiap Maba tersedia pada sheet Jawaban K1 dalam berkas data mentah.')

# ======================================================================
CHAP('POTENSI MABA')
SEC(1, 'Kuadran Potensi')
IMG(FIG + 'quad.png', 15.0)
CAP_F('Kuadran Potensi per Bidang')
CAP_T('Jumlah Maba per Kuadran Potensi')
QO = ['Unggulan', 'Berkembang', 'Laten', 'Pasif', 'Rendah']
TABLE(['Bidang'] + QO, [[b['label']] + [n(b['quad'].get(o, 0)) for o in QO] for b in S['q1b']], [3.6, 2.5, 2.6, 2.5, 2.5, 2.5])
P(f'Bidang {ung["label"]} memiliki Maba Unggulan terbanyak, yaitu {n(ung["quad"].get("Unggulan", 0))} Maba yang sudah berminat dan berpengalaman sehingga siap diberi peran. Bidang {lat["label"]} memiliki Maba Laten terbanyak ({n(lat["quad"].get("Laten", 0))} Maba). Kelompok Laten adalah sasaran yang paling strategis bagi HMD karena Maba sudah berminat tetapi belum pernah mendapat kesempatan.')
SEC(2, 'Kandidat Prioritas')
P(f'Sebanyak {n(S["q1prio"])} Maba ({p(S["q1prio"] / q1["valid"])} responden valid) memenuhi kriteria kandidat prioritas. Sebarannya per bidang adalah sebagai berikut; satu Maba dapat menjadi kandidat pada lebih dari satu bidang.')
CAP_T('Kandidat Prioritas per Bidang')
TABLE(['Bidang', 'Jumlah kandidat prioritas', 'Jumlah Maba kuadran Unggulan'],
      [[b['label'], n(S['q1prioBid'][b['label']]), n(S['q1rekom'][b['label']])] for b in S['q1b']], [5.0, 5.6, 5.6])
P('Nama kandidat prioritas dapat dilihat pada sheet Peminatan & Potensi dengan menyaring kolom Kandidat Prioritas bernilai "Ya".')
SEC(3, 'Bidang Unggulan Menurut Penilaian GRADAKS')
P(f'Dari sisi penilaian mentor, setiap Maba dapat dilihat bidang dengan evaluasi tertingginya. Sebanyak {n(sum(tb.values()))} Maba layak diagregasi memiliki satu bidang tertinggi yang jelas, yaitu Minat Bakat ({n(tb.get("MB", 0))}), Keilmiahan ({n(tb.get("K", 0))}), Manajerial ({n(tb.get("M", 0))}), dan Kewirausahaan ({n(tb.get("KW", 0))}). Sebanyak {n(S["topTie"])} Maba memperoleh nilai tertinggi yang sama pada dua bidang atau lebih, sehingga bidang unggulannya perlu dikonfirmasi langsung kepada Maba.')
SEC(4, 'Profil Kepribadian (MBTI)')
mb = S['mbtiDims']
P(f'Data MBTI tersedia bagi {np_(S["mbtiN"], nT)} Maba. MBTI menggambarkan kecenderungan gaya, bukan kemampuan, sehingga tidak digunakan untuk menilai atau menyeleksi Maba.')
CAP_T('Kecenderungan MBTI')
TABLE(['Dimensi', 'Kecenderungan dominan', 'Persentase'], [[d['dim'], d['a'] if d['pa'] >= d['pb'] else d['b'], p(max(d['pa'], d['pb']))] for d in mb] +
      [['Tipe terbanyak', ', '.join(t for t, *_ in S['mbtiTypes'][:3]), ', '.join(p(a) for _, _, a, _ in S['mbtiTypes'][:3])]], [4.0, 6.2, 6.0])
P('Kecenderungan ini dapat membantu HMD merancang variasi metode pembinaan, misalnya memadukan diskusi konseptual dengan kegiatan praktik, tanpa mengelompokkan Maba berdasarkan tipenya.')

# ======================================================================
CHAP('PERBEDAAN HASIL KUESIONER 1 DAN PENILAIAN GRADAKS')
P(f'Bagian ini membandingkan bidang yang diminati Maba menurut Kuesioner 1 dengan bidang yang dinilai paling menonjol oleh mentor dalam penilaian GRADAKS. Perbandingan dilakukan pada {n(cmp_comp)} Maba yang memiliki kedua data secara lengkap.')
IMG(FIG + 'cmp.png', 15.5)
CAP_F('Perbandingan Kuesioner 1 dan Penilaian GRADAKS')
CAP_T('Perbandingan per Bidang')
TABLE(['Bidang', 'Minat tinggi (Kuesioner 1)', 'Sangat Baik (penilaian GRADAKS)', 'Keduanya', 'Selisih'],
      [[c['label'], np_(c['hiK'], c['n'], 0), np_(c['sbG'], c['n'], 0), n(c['bothHi']), ('+' if c['sbG'] >= c['hiK'] else '−') + n(abs(c['sbG'] - c['hiK']))] for c in S['cmpBid']],
      [3.2, 3.6, 3.8, 2.6, 2.4])
over = [c for c in S['cmpBid'] if c['sbG'] > c['hiK']]
under = [c for c in S['cmpBid'] if c['sbG'] < c['hiK']]
P('Kolom selisih menunjukkan jumlah Maba yang dinilai Sangat Baik oleh mentor dikurangi jumlah Maba yang menyatakan minat tinggi. ' +
  (f'Pada bidang {" dan ".join(c["label"] for c in over)}, mentor menilai lebih banyak Maba berpotensi dibandingkan jumlah Maba yang menyatakan minat. Artinya, ada Maba yang mampu tetapi belum menyadari atau belum menyatakan minatnya. ' if over else '') +
  (f'Sebaliknya, pada bidang {", ".join(c["label"] for c in under)}, jumlah Maba yang berminat lebih banyak daripada yang dinilai Sangat Baik. Artinya, minat tersebut belum sepenuhnya terlihat dalam kegiatan selama rangkaian.' if under else ''))
CAP_T('Kesesuaian Bidang Teratas per Maba')
TABLE(['Kategori', 'Arti', 'Jumlah Maba'], [
    ['Sesuai', 'Bidang minat dominan Kuesioner 1 sama dengan bidang evaluasi mentor tertinggi', n(cmp_.get('Sesuai', 0))],
    ['Berbeda', 'Bidang minat dominan Kuesioner 1 tidak sama dengan bidang evaluasi mentor tertinggi', n(cmp_.get('Berbeda', 0))],
    ['Seimbang', 'Mentor memberi nilai yang sama pada keempat bidang', n(cmp_.get('Penilaian GRADAKS seimbang di semua bidang', 0))],
    ['Tidak dapat dibandingkan', 'Tidak mengisi Kuesioner 1, jawaban seragam, atau evaluasi mentor kosong', n(cmp_.get('Tidak dapat dibandingkan', 0))],
], [3.8, 9.6, 2.8], ['l', 'l', 'c'])
P(f'Dari {n(cmp_valid)} Maba yang bidang teratasnya dapat dibandingkan, {np_(cmp_.get("Sesuai", 0), cmp_valid)} menunjukkan hasil yang sesuai dan {np_(cmp_.get("Berbeda", 0), cmp_valid)} berbeda. Perbedaan ini wajar karena Kuesioner 1 diisi sebelum Maba mengikuti kegiatan, sedangkan penilaian mentor diberikan setelah Maba menjalani rangkaian. Secara statistik, hubungan antara skor minat dan evaluasi mentor tergolong {REL_TXT}, sehingga minat yang dinyatakan di awal belum dapat dijadikan satu-satunya dasar untuk menentukan bidang Maba.')
P('Cara memanfaatkan hasil perbandingan ini:', after=4, keep=True)
LIST([
    '**Sesuai:** minat dan penilaian sejalan. Maba dapat langsung diarahkan ke bidang tersebut.',
    '**Berbeda:** tanyakan langsung kepada Maba bidang mana yang ingin ditekuni, lalu berikan kesempatan mencoba keduanya.',
    '**Seimbang:** gunakan hasil Kuesioner 1 dan pilihan Maba sebagai acuan utama.',
    '**Tidak dapat dibandingkan:** lakukan pemetaan singkat melalui wawancara atau formulir HMD.',
])
P('Kategori kesesuaian setiap Maba tersedia pada kolom Kesesuaian K1 vs GRADAKS di sheet Peminatan & Potensi.')

# ======================================================================
CHAP('DATA MABA YANG PERLU DITINJAU')
P('Penandaan berikut bersifat awal, bukan diagnosis dan bukan sanksi. Satu Maba dapat memenuhi lebih dari satu kriteria. Daftar nama lengkap tersedia pada sheet Perlu Ditinjau dalam berkas data mentah.')
CAP_T('Kriteria Maba yang Perlu Ditinjau')
TABLE(['No', 'Kriteria', 'Penjelasan', 'Jumlah', 'Langkah awal'], [[i, c['name'], c['defn'], n(c['n']), c['step']] for i, c in enumerate(S['crit'], 1)],
      [0.9, 3.2, 4.6, 1.5, 6.0], ['c', 'l', 'l', 'c', 'l'], size=9)
P(f'Tanpa menghitung kriteria tidak mengisi Kuesioner 1, terdapat {n(S["critUnion"])} Maba yang memenuhi sedikitnya satu kriteria. Prioritas pertama adalah {n(S["notNoTemu"])} Maba yang tidak pernah menghadiri Temu FTEIC, karena status keaktifan akademiknya perlu dipastikan. Jumlah pada kriteria Nilai Keahlian rendah sebagian besar disebabkan oleh belum diikutinya Kegiatan Keahlian, sehingga langkah yang tepat adalah membuka akses kegiatan, bukan pendampingan personal.')
P('Untuk kriteria catatan khusus mentor, rincian catatan hanya dapat diperoleh melalui PSDM dan harus ditangani secara tertutup. Apabila terdapat informasi kesehatan, kondisi psikologis, atau kendala akademik, penanganannya bersifat rahasia dan sebaiknya melibatkan layanan profesional seperti layanan konseling ITS atau dosen wali.')
CAP_T('Kelompok Pembinaan')
TABLE(['Kelompok', 'Jumlah', 'Saran pembinaan'], [
    ['Nilai Personal dan Keahlian Sangat Baik', n(seg.get('both', 0)), 'Libatkan sebagai penggerak kegiatan atau mentor sebaya'],
    ['Salah satu nilai Sangat Baik', n(seg.get('one', 0)), 'Beri tantangan pada bidang yang kuat dan dorong mencoba bidang lain'],
    ['Kedua nilai Baik', n(seg.get('mid', 0)), 'Penugasan terstruktur dan umpan balik berkala'],
    ['Salah satu nilai di bawah 70', n(seg.get('low', 0)), 'Pendampingan terarah, terutama akses Kegiatan Keahlian'],
    ['Tidak layak diagregasi', n(nTn), 'Pendekatan personal dan konfirmasi status keaktifan'],
], [5.6, 1.8, 8.8], ['l', 'c', 'l'])
CAP_T(f'List Mahasiswa Baru {DN} yang Tidak Lulus IPF')
if S['ipfFail']:
    TABLE(['NO', 'Nama', 'NRP'], [[i, nm, nrp] for i, (nm, nrp) in enumerate(S['ipfFail'], 1)], [1.4, 9.0, 5.0], ['l', 'l', 'l'])
else:
    P(f'Tidak terdapat mahasiswa baru {DN} yang tidak lulus IPF.')

# ======================================================================
CHAP('DATA MENTOR ANGKATAN 2025')
mp = [m['pct'] for m in mentors if m['pct'] is not None]
mk = [m['keaktifan'] for m in mentors if m['keaktifan'] is not None]
full = sum(1 for m in mentors if m['pct'] == 1)
P(f'Sebanyak {n(len(mentors))} mahasiswa {DN} angkatan 2025 bertugas sebagai mentor GRADAKS 2026. Setiap mentor mendampingi satu unit yang berisi Maba dari berbagai departemen. Kehadiran mentor dicatat oleh Kepala Region pada tujuh sesi, yaitu Sesi 1.0, Sesi 1.1, Sesi 2.0, Inclenation hari 1 dan 2, TOT 1, dan Temu FTEIC 0, beserta skor keaktifan pada skala 1–4.')
if mp:
    P(f'Rata-rata kehadiran mentor {DN} pada sesi yang tercatat adalah {p(sum(mp) / len(mp))} dengan rata-rata keaktifan {f2(sum(mk) / len(mk))} dari 4. Sebanyak {n(full)} mentor hadir pada seluruh sesi yang tercatat. Sesi yang tidak tercatat, misalnya Sesi 2.0 yang hanya direkap untuk sebagian mentor, tidak dihitung sebagai ketidakhadiran.')
CAP_T(f'Kehadiran dan Keaktifan Mentor {DN} Angkatan 2025')
TABLE(['No', 'Nama mentor', 'Unit yang dibina', 'Jumlah Maba dibina', 'Hadir', 'Izin', 'Tidak tercatat', '% Hadir', 'Keaktifan (1–4)'],
      [[i, nice_name(m['name']), m['unit'], n(m['nmaba']), m['H'], m['I'], m['TC'], p(m['pct'], 0), f2(m['keaktifan'])] for i, m in enumerate(mentors, 1)],
      [0.8, 4.4, 3.4, 1.6, 1.2, 1.1, 1.6, 1.4, 1.7], ['c', 'l', 'l', 'c', 'c', 'c', 'c', 'c', 'c'], size=9)
P(f'% Hadir dihitung dari sesi yang tercatat. Rincian kehadiran mentor per sesi tersedia pada berkas data mentah mentor: **{LINK_MENTOR}**.')

# ======================================================================
CHAP('REKOMENDASI UNTUK HMD')
PROG = {'Kewirausahaan': 'Kelas atau mentoring bisnis dan kunjungan alumni wirausaha',
        'Manajerial': 'Pelatihan kepemimpinan dan peran kepanitiaan bertahap dengan pendampingan senior',
        'Keilmiahan': 'Kelompok studi, pendampingan lomba karya tulis, dan pengenalan laboratorium',
        'Minat Bakat': 'Komunitas minat bakat departemen dan pendampingan kompetisi non-akademik'}
P(f'Rekomendasi berikut bersifat rujukan. HMD {DN} dapat menyesuaikannya dengan kebijakan dan kapasitas kaderisasi departemen.')
SEC(1, 'Program Penguatan')
CAP_T('Usulan Program Penguatan')
TABLE(['Fokus', 'Alasan', 'Usulan program'], [
    ['Akses Kegiatan Keahlian', f'Baru {p(keah_any / nT)} Maba mengikuti Kegiatan Keahlian', 'Kalender kegiatan keahlian departemen yang terbuka bagi seluruh Maba (kelompok studi, lomba, komunitas)'],
    [skm_sorted[0]['label'], 'Evaluasi mentor terendah' + (' dan minat Kuesioner 1 terendah' if q1_sorted[0]['label'] == skm_sorted[0]['label'] else ''), PROG[skm_sorted[0]['label']]],
    ['Komunikasi dan kerja sama', f'Butir {lb2["label"]} termasuk yang terendah', 'Presentasi bergilir di forum angkatan dan proyek kecil lintas kelompok'],
] + ([['Kepemimpinan', 'Pernyataan minat memimpin paling sedikit disetujui', 'Peran kepanitiaan bertahap dengan pendampingan senior']] if qi[0]['code'].startswith('MN') else
     [[q1_sorted[0]['label'], 'Minat Kuesioner 1 terendah', PROG[q1_sorted[0]['label']]]] if q1_sorted[0]['label'] != skm_sorted[0]['label'] else []) + [
], [3.8, 5.6, 6.8], ['l', 'l', 'l'])
SEC(2, 'Pemanfaatan Peta Minat dan Potensi')
LIST([
    'Undang Maba kuadran Unggulan untuk mengisi peran awal pada kegiatan atau kepanitiaan HMD.',
    f'Prioritaskan undangan bagi Maba kuadran Laten, terutama pada bidang {lat["label"]}, karena mereka berminat tetapi belum berpengalaman.',
    'Untuk Maba dengan hasil Kuesioner 1 dan penilaian GRADAKS yang berbeda, konfirmasi pilihan bidangnya secara langsung.',
    'Peta minat digunakan sebagai undangan, bukan saringan. Data ini tidak boleh menjadi syarat atau dasar penolakan pada open recruitment.',
    'Hasil MBTI tidak digunakan untuk menyeleksi atau menempatkan Maba.',
])
SEC(3, 'Pendampingan dan Pengukuran Lanjutan')
LIST([
    f'Lakukan pendekatan personal kepada {n(nTn)} Maba yang tidak layak diagregasi, diawali dengan {n(S["notNoTemu"])} Maba yang tidak pernah menghadiri Temu FTEIC.',
    'Gunakan NRP sebagai kunci data agar data kegiatan HMD dapat disambungkan dengan data GRADAKS.',
    'Lakukan pengukuran ulang minat dengan butir Kuesioner 1 yang sama pada akhir semester genap untuk melihat perubahan minat Maba.',
], 'num')

# ======================================================================
CHAP('KETENTUAN PENGGUNAAN DATA')
P(f'**Data dalam laporan ini dan berkas data mentahnya bersifat rahasia.** HMD {DN} sebagai penerima data wajib mematuhi ketentuan berikut.')
LIST([
    'Data individual hanya dapat diakses oleh Ketua Himpunan dan pengurus yang ditunjuk secara tertulis oleh Ketua Himpunan.',
    'Data hanya digunakan untuk pembinaan dan kaderisasi Maba di lingkungan HMD.',
    'Data tidak boleh disebarkan kepada pihak yang tidak berwenang, termasuk melalui media sosial, grup percakapan, atau tangkapan layar.',
    'Nilai, status agregasi, peta minat, dan MBTI tidak boleh digunakan sebagai dasar seleksi, penempatan, pelabelan, atau diskriminasi terhadap Maba.',
    'Berkas data mentah hanya diperkenankan untuk dilihat dan ditinjau oleh PSDM HMD.',
    'Data individual disimpan paling lama satu periode kepengurusan, kemudian dihapus dari seluruh media penyimpanan.',
], 'num')

# ======================================================================
CHAP('PENUTUP')
P(f'Laporan ini menyajikan peminatan, nilai, potensi, dan data Maba {DN} yang perlu ditinjau sebagai hasil rangkaian GRADAKS 2026. Secara umum, Maba {DN} menunjukkan **keterlibatan yang tinggi** pada kegiatan inti dan nilai **pengembangan karakter** yang **baik**, dengan ruang penguatan pada keikutsertaan kegiatan keahlian, bidang {skm_sorted[0]["label"]}, serta kemampuan komunikasi' + (' dan kepemimpinan' if qi[0]['code'].startswith('MN') else '') + '.')
P(f'Kami berharap data ini menjadi titik awal kaderisasi di tingkat departemen sehingga HMD {DN} dapat melanjutkan pembinaan secara lebih terarah tanpa mengulang pemetaan dasar. Terima kasih atas kerja sama seluruh pihak.')

# ======================================================================
H('LAMPIRAN', 1)
_chap[0] = 'L'; _tab[0] = 0
H('Lampiran A. Daftar Berkas Data Mentah', 2)
P('Berkas data mentah dibagikan melalui tautan berikut dengan akses terbatas sesuai Ketentuan Penggunaan Data.')
CAP_T('Daftar Berkas')
TABLE(['Berkas', 'Isi', 'Tautan'], [
    [f'Data mentah Maba {DN}', f'Peminatan, nilai, potensi, data perlu ditinjau, kehadiran, dan rincian butir untuk {n(nT)} Maba', LINK_MABA],
    ['Data mentah mentor', 'Rekap kehadiran dan keaktifan mentor per sesi', LINK_MENTOR],
], [4.0, 7.6, 4.6], ['l', 'l', 'c'])
H('Lampiran B. Isi Berkas Data Mentah Maba', 2)
CAP_T('Daftar Sheet')
TABLE(['No', 'Sheet', 'Isi', 'Jumlah baris'], [[i, s[0], s[1], '–' if s[2] is None else n(s[2])] for i, s in enumerate(SHEETS, 1)],
      [1.0, 3.4, 9.4, 2.4], ['c', 'l', 'l', 'c'], size=9)

doc.save(OUT)
print('docx ok', OUT)
