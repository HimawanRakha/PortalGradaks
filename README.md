# Portal Pengembangan MABA 26

Portal scoring mentor & pemantauan terpusat untuk seluruh alur pengembangan mahasiswa baru — GRADAKS 2026, PSDM BEM FTEIC. Menggantikan 140 salinan workbook Excel per mentor dengan satu database, form pengisian context-aware, dan dashboard berjenjang (Mentor → Kepala Region → PSDM).

Dibangun berdasarkan `Brief_Portal_Pengembangan_MABA26_v2.docx`.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **PostgreSQL** (Neon) via **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Auth.js / NextAuth v5** — kredensial NRP + password (bcryptjs)
- **shadcn/ui** (preset `base-nova`, dibangun di atas `@base-ui/react`, bukan Radix) + Tailwind v4
- **exceljs** (ekspor multi-sheet), **csv-parse** (impor)

> ⚠️ Komponen UI di `components/ui/*` memakai prop `render={<Element />}`, **bukan** `asChild` — lihat file apa pun di `components/ui` untuk contoh sebelum menambah komponen baru.

## Setup

1. **Database**: buat project Postgres gratis di [neon.tech](https://neon.tech), salin *pooled connection string*.
2. Salin `.env` dan isi `DATABASE_URL` dengan connection string tsb. (`AUTH_SECRET` juga wajib diisi di production — generate dengan `npx auth secret`.)
3. Install dependency (sudah dilakukan jika kloning repo ini apa adanya): `npm install`
4. Jalankan migrasi: `npx prisma migrate dev --name init`
5. Isi seed data (struktural, lihat catatan di bawah): `npx prisma db seed`
6. `npm run dev`

Untuk reseed dari kosong (mis. setelah ubah schema): `npx prisma migrate reset` (otomatis menjalankan seed ulang).

### Akun demo (dari seed, password sama untuk semua: `gradaks2026`)

| Peran | NRP |
|---|---|
| PSDM / Admin | `admin` |
| Kepala Region (contoh) | `kr.r01` |
| Mentor (contoh) | `mentor.r01-u01` |
| Damen (demo) | `damen1` |

## Apa yang masih placeholder (dan kenapa)

Brief-nya sendiri mengakui beberapa hal ini **belum final bahkan di proyek aslinya** — bukan sesuatu yang bisa ditebak dengan benar, jadi semuanya dibuat jelas dapat diedit lewat Master Data, bukan di-hardcode:

- **Data organisasi** (nama 14 region, unit, mentor, departemen/HMD) — diseed sebagai placeholder (`Region 1`, `Unit 1`, dst). Ganti lewat `/admin/master-data/accounts` atau impor CSV di `/admin/imports`.
- **Teks rubrik jangkar perilaku** (KWYA/BMB/JAD/HTWF/WUWE) — diseed sebagai `TODO-PSDM: ...` per brief §10 ("blocking non-technical issue: PSDM wajib mengesahkan rubrik sebelum go-live"). Edit di `/admin/master-data/parameters`.
- **Bobot Nilai Personal/Nilai Keahlian** — mesin kalkulasi (`lib/scoring/calculate.ts`) memakai **rata-rata berbobot** (bukan jumlah berbobot), supaya hasil selalu di skala 0-100 berapa pun jumlah parameter yang ada. Bobot per parameter ada di `Parameter.personalWeight`/`skillWeight`; bobot global (kontribusi kehadiran/logbook/K1/K2) ada di tabel `Setting`, keduanya dapat diubah di `/admin/master-data`.
- **Skema kolom CSV impor** — brief tidak menyertakan contoh ekspor GForm asli, jadi skema kolom per jenis impor didefinisikan sendiri (didokumentasikan di halaman `/admin/imports`) mengikuti struktur yang brief jelaskan.

## Arsitektur singkat

- `prisma/schema.prisma` — model data inti. Prinsip: aktivitas/materi/parameter adalah **data**, bukan enum/kode — menambah kegiatan tahun depan = tambah baris, bukan ubah kode. Skor disimpan long-format dengan constraint unik `(studentId, parameterId, sessionId)` sebagai mekanisme anti-duplikat untuk submit idempoten.
- `lib/auth/dal.ts` — satu-satunya tempat keputusan otorisasi scope-based (Mentor → unit sendiri, KR → region sendiri, PSDM → semua). `proxy.ts` hanya melakukan redirect optimis, bukan keputusan otorisasi sesungguhnya.
- `lib/scoring/calculate.ts` — mesin kalkulasi Nilai Personal/Keahlian, dipakai baik untuk pratinjau live maupun untuk snapshot resmi saat finalisasi (`RaportSnapshot`, ditulis sekali, tidak pernah diubah retroaktif).
- `lib/scoring/upsert.ts` — satu-satunya jalur tulis untuk Score/Attendance/GroupScore; selalu upsert (bukan create), dan mencatat `AuditLog` saat sebuah nilai yang sudah ada benar-benar berubah.
- Struktur halaman mengikuti tiga peran: `app/(dashboard)/mentor`, `.../kepala-region`, `.../admin` (PSDM), plus `.../damen` (opsional/minimal sesuai brief).

## Scripts

```bash
npm run dev      # dev server (Turbopack)
npm run build
npm run start
npm run lint
npx tsc --noEmit # type-check
npx prisma studio # lihat/edit data lewat GUI
```
