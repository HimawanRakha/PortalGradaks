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

## 2. Keamanan & Proteksi Traffic (Cloudflare WAF & Anti-DDoS)

Untuk perlindungan tingkat jaringan (*network security*), pencegahan serangan DDoS, pemblokiran bot jahat, dan pemantauan lalu lintas IP:

### Langkah Setup Cloudflare (Gratis):
1. **Daftar & Tambahkan Domain**:
   * Buat akun di [Cloudflare Dashboard](https://dash.cloudflare.com/).
   * Tambahkan domain website Portal Anda (misal `portal-maba.its.ac.id` atau domain kustom Anda).
2. **Ubah Nameserver DNS**:
   * Ubah Nameserver di penyedia domain Anda (Registrar) ke Nameserver yang diberikan oleh Cloudflare.
3. **Aktifkan Proteksi Keamanan**:
   * **Security Level**: Atur ke **Medium** atau **High** di menu *Security -> Settings*.
   * **Bot Fight Mode**: Aktifkan di menu *Security -> Bots* untuk otomatis menghalangi bot jahat/scraper.
   * **Rate Limiting Rule**: Tambahkan rule untuk membatasi request pada endpoint login (`/login` & `/api/auth/*`) max 10 request per menit per IP untuk mencegah *brute-force attack*.
4. **Pantau Traffic Keamanan**:
   * Buka tab **Security -> Events** di Cloudflare untuk melihat grafik percobaan peretasan, serangan yang diblokir, lokasi negara pengakses, dan IP mencurigakan.

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
