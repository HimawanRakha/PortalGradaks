# Panduan Sistem Monitoring & Keamanan (Security Monitoring Guide)

Dokumen ini berisi panduan lengkap untuk mengatur sistem pemantauan (*monitoring*), deteksi ancaman keamanan (*security threat detection*), pelaporan error (*error reporting*), dan analitik perilaku pengguna pada **Portal Pengembangan MABA 2026 (PortalGradaks)**.

---

## 1. Monitoring Internal Pengguna Aktif (Built-in Active Users)

Portal ini sudah dilengkapi dengan fitur **Internal Active User Monitoring** di Dashboard Admin (`/admin`).

### Cara Kerja:
* **Lazy Throttled Tracking**: Setiap kali user melakukan navigasi atau request yang memicu `verifySession()`, sistem mengecek timestamp `lastActiveAt` pengguna.
* Jika `lastActiveAt` kosong atau lebih tua dari **2 menit**, sistem akan memperbarui waktu aktif di database Postgres secara *asynchronous* (tanpa menghambat waktu loading halaman).
* **Threshold Online**: Pengguna dianggap online jika memiliki aktivitas dalam **15 menit terakhir**.

---

## 2. Keamanan & Proteksi Traffic (Vercel & Cloudflare)

> [!NOTE]
> **Domain `portal-gradaks.vercel.app`**:
> Subdomain `*.vercel.app` secara otomatis sudah dilindungi oleh **Vercel Edge Network & Automatic DDoS Protection**.
> Cloudflare DNS management khusus digunakan jika Anda menggunakan **Custom Domain** sendiri (misal `gradaks.id` atau `portal-maba.com`).

### A. Fitur Keamanan Bawaan Vercel (Untuk `portal-gradaks.vercel.app`):
1. **DDoS Protection & Edge Network**: Otomatis aktif di seluruh deployment Vercel.
2. **Vercel Web Analytics & Speed Insights**: Dapat diaktifkan 1-klik melalui *Vercel Dashboard -> Analytics*.
3. **Vercel Firewall & Attack Challenge**: Dapat diatur pada *Vercel Dashboard -> Settings -> Security*.

### B. Langkah Setup Cloudflare (Jika Menggunakan Custom Domain):

1. **Tambahkan Domain di Vercel**:
   * Buka [Vercel Dashboard](https://vercel.com/dashboard) -> Project PortalGradaks -> **Settings** -> **Domains**.
   * Masukkan domain/subdomain Anda (misal `portal.domainanda.com`) dan klik **Add**.

2. **Setup DNS Record di Cloudflare**:
   * Login ke [Cloudflare Dashboard](https://dash.cloudflare.com/) -> Pilih Domain -> Menu **DNS** -> **Records**.
   * Tambahkan record berikut:
     * **Type**: `CNAME`
     * **Name**: `@` (untuk root) atau `portal` (untuk subdomain)
     * **Target**: `cname.vercel-dns.com`
     * **Proxy Status**: **Proxied (Awan Oranye)**

3. **Konfigurasi Enkripsi SSL/TLS (PENTING)**:
   * Di Cloudflare, buka menu **SSL/TLS** -> **Overview**.
   * Ubah Encryption Mode ke **Full (strict)** (atau **Full**).
   * *Catatan*: **Jangan pilih Flexible**, karena akan menyebabkan error *Infinite Redirect (ERR_TOO_MANY_REDIRECTS)* dengan Vercel.
   * Masuk ke **SSL/TLS** -> **Edge Certificates** -> Aktifkan **Always Use HTTPS** (ON).

4. **Aktifkan Fitur Keamanan WAF & Anti-Bot**:
   * **Bot Fight Mode**: Buka *Security -> Bots*, aktifkan **Bot Fight Mode** (ON).
   * **Security Level**: Buka *Security -> Settings*, atur ke **Medium** atau **High**.
   * **Rate Limiting (Proteksi Login)**: Buka *Security -> WAF -> Rate limiting rules*, buat rule untuk membatasi endpoint `/login` dan `/api/auth/*` max 10 request per menit per IP.

5. **Verifikasi Status**:
   * Kembali ke Vercel Domains tab. Pastikan status domain berubah menjadi **Valid Configuration** (Centang Hijau).

---

## 3. Pelaporan Error & Performa Aplikasi (Sentry Monitoring)

Untuk mendapatkan notifikasi instan ketika terjadi error 500, kegagalan database, atau halaman crash pada user:

### Langkah Setup Sentry di Next.js:
1. **Daftar Sentry**:
   * Buat akun gratis di [Sentry.io](https://sentry.io/). Buat project baru dengan tipe **Next.js**.
2. **Install Sentry Wizard**:
   Jalankan perintah berikut di root folder project:
   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```
3. **Konfigurasi Otomatis**:
   Sentry Wizard akan membuat berkas `sentry.client.config.ts`, `sentry.server.config.ts`, dan `sentry.edge.config.ts` secara otomatis, serta menambahkan `NEXT_PUBLIC_SENTRY_DSN` pada `.env`.
4. **Notifikasi Telegram / Email**:
   * Masuk ke *Sentry -> Alerts -> Integrations* untuk menghubungkan Sentry dengan **Telegram Bot** atau **Discord Webhook**.
   * Setiap kali ada error pada server atau mentor gagal menginput nilai, tim IT akan menerima notifikasi instan.

---

## 4. Analitik Perilaku & Session Replay (PostHog - Opsional)

Jika Anda memerlukan analitik perilaku tingkat lanjut, seperti melihat **rekaman layar (*session replay*)** pengguna atau alur *clickmap*:

### Langkah Setup PostHog:
1. **Daftar PostHog Cloud**:
   * Buat akun gratis di [PostHog](https://us.posthog.com/).
2. **Install SDK**:
   ```bash
   npm install posthog-js
   ```
3. **Identifikasi Pengguna**:
   Pada komponen layout dashboard (`app/(dashboard)/layout.tsx`), panggil:
   ```ts
   import posthog from 'posthog-js'

   posthog.identify(user.id, {
     name: user.name,
     nrp: user.nrp,
     role: user.role
   })
   ```
4. **Pantau Dashboard PostHog**:
   Anda dapat melihat secara *live* siapa saja yang membuka portal, tombol apa yang diklik, dan merekam *session* saat terjadi kendala penggunaan.

---

## Ringkasan Matriks Solusi

| Kebutuhan | Solusi | Lokasi Monitor | Biaya |
| :--- | :--- | :--- | :--- |
| **Daftar User Online Real-Time** | Built-in Portal | Dashboard Admin (`/admin`) | **Gratis (Internal)** |
| **Audit Trail Edit Nilai/Maba** | Built-in Portal | Log Aktivitas (`/admin/activity-log`) | **Gratis (Internal)** |
| **Proteksi Hacker & DDoS** | Cloudflare WAF | Dashboard Cloudflare | **Gratis** |
| **Notifikasi Crash / Server Error** | Sentry | Sentry & Telegram / Email | **Gratis** |
| **Session Replay & Heatmap** | PostHog | Dashboard PostHog | **Gratis** |
