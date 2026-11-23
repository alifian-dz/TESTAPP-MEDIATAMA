# Mediatama Vault — Time-Bound Video Access Control System

Aplikasi **Time-Bound Video Access Control System** berbasis web yang dibangun menggunakan **Next.js 15 (App Router)**, **TypeScript**, **Prisma ORM (v6)**, **PostgreSQL**, **Tailwind CSS**, dan **shadcn/ui**. Sistem ini memungkinkan Administrator mengelola akun Customer, mengunggah file video fisik ke penyimpanan privat server, serta memberikan izin menonton video dengan batas waktu (*time-bound permission*) yang otomatis menghentikan pemutaran video dan membersihkan *buffer* saat waktu akses habis.

---

## Daftar Isi
1. [Deskripsi Sistem & Fitur Utama](#1-deskripsi-sistem--fitur-utama)
2. [Tech Stack](#2-tech-stack)
3. [Arsitektur Database & ERD](#3-arsitektur-database--erd)
4. [Alur Kerja Sistem (End-to-End Workflow)](#4-alur-kerja-sistem-end-to-end-workflow)
5. [Panduan Instalasi Lokal & Import `database.sql`](#5-panduan-instalasi-lokal--import-databasesql)
6. [Akun Demo & Skenario Testing Cepat (1 Menit)](#6-akun-demo--skenario-testing-cepat-1-menit)

---

## 1. Deskripsi Sistem & Fitur Utama

Sistem ini dirancang untuk memenuhi seluruh spesifikasi studi kasus **Mediatama Web Developer Test**, dilengkapi beberapa penyempurnaan UX dan keamanan:

### Hak Akses, Otentikasi & Multi-Bahasa
- **2 Role Pengguna (`ADMIN` & `CUSTOMER`)**:
  - Customer **tidak dapat melakukan registrasi mandiri (no public registration)**. Seluruh akun Customer dibuat dan dikelola secara eksklusif oleh Admin.
  - Sesi otentikasi menggunakan **JWT (`jose`)** di dalam cookie `httpOnly` (`session_token`).
  - Proteksi berlapis melalui **Next.js Middleware (`src/middleware.ts`)** dan **Server-Side Auth Guards (`requireAdmin()`, `requireAuth()`, `requireCustomerPage()`)** yang juga memvalidasi status *soft delete* pada setiap halaman dan API Route.
- **Bilingual Toggle (`ID / EN`)**:
  - Tersedia tombol pergantian bahasa **Indonesia / Inggris** di halaman Login, Admin Console, Customer Portal, dan Video Player untuk memudahkan peninjauan.

### Fitur Role `ADMIN`
- **CRUD Data Customer (`/admin/customers`)**:
  - Pencarian nama/email, tambah akun customer baru, ubah profil/reset password (`bcryptjs`), dan **Soft Delete** (`deletedAt`) yang otomatis mencabut izin aktif, menolak request pending, dan memblokir login customer tersebut (serta mendukung *auto-restore* apabila email yang sama didaftarkan kembali).
- **CRUD Data Video Privat (`/admin/videos`)**:
  - Mengunggah file video fisik (`video/mp4`, `video/webm`, `video/ogg`, maks. 100MB) langsung ke direktori privat server `storage/videos/` (bukan di dalam `public/`) menggunakan penamaan berbasis `UUID`.
  - Mengubah metadata video (Judul & Deskripsi), mengganti file video fisik (otomatis menghapus file lama dari disk), **Soft Delete** video (otomatis mencabut izin aktif & menjaga audit trail), serta **Admin Preview Player**.
- **Persetujuan Permintaan, Bulk Direct Grant & Cabut Akses (`/admin/requests`)**:
  - **Approve Request dengan Batas Waktu**: Menyetujui permintaan akses customer menggunakan preset cepat (*1 Menit [Testing]*, *5 Menit*, *1 Jam*, *24 Jam*, *3 Hari*) atau input durasi kustom (Menit / Jam / Hari).
  - **Bulk Direct Grant (*Beri Akses Langsung*)**: Admin dapat memilih **satu atau banyak Customer** sekaligus **satu atau banyak Video** beserta durasinya dalam satu aksi, tanpa harus menunggu customer mengajukan request.
  - **Cabut Akses (*Revoke*)**: Menghentikan izin akses aktif customer secara instan.

### Fitur Role `CUSTOMER`
- **Katalog Video & Status Dinamis (`/dashboard`)**:
  - Menampilkan seluruh video dengan 5 status efektif yang dihitung secara otomatis:
    1. `NO_ACCESS` (*Belum Ada Akses* -> Tombol **"Minta Akses Menonton"**)
    2. `PENDING` (*Menunggu Konfirmasi Admin* -> Tombol dinonaktifkan)
    3. `ACTIVE` (*Akses Aktif* -> Status *Siap Ditonton* atau hitung mundur *real-time* + Tombol **"Tonton Video"**)
    4. `EXPIRED` (*Waktu Akses Habis* -> Tombol **"Minta Akses Ulang"**)
    5. `REJECTED` (*Permintaan Ditolak* -> Tombol **"Minta Akses Ulang"**)
  - Tabel **Riwayat Permintaan Akses** yang mencatat seluruh histori pengajuan dan waktu kedaluwarsa.
- **Lazy-Start Countdown & Hard Expiration Cutoff (`/dashboard/watch/[id]`)**:
  - **Lazy-Start Countdown**: Saat Admin menyetujui atau memberi akses langsung, `startedAt` dan `expiresAt` bernilai `null` (durasi disimpan pada `durationMinutes`). **Timer hitung mundur baru mulai berjalan tepat saat Customer pertama kali membuka pemutar video**, sehingga durasi menonton customer tidak terbuang sia-sia selama menunggu.
  - Streaming video melalui endpoint terproteksi `GET /api/videos/[id]/stream` dengan dukungan **HTTP Range (`206 Partial Content`)** dan `Cache-Control: private, no-store` sehingga fitur *seeking* berjalan mulus dan bebas kebocoran *file descriptor*.
  - **Hard Expiration Cutoff**: Tepat saat waktu hitung mundur mencapai `00:00:00` (atau saat akses dicabut Admin), pemutar video langsung melakukan `pause()`, menghapus atribut `src`, memanggil `load()` untuk menguras *pre-buffered video* dari memori browser, mengganti tampilan dengan kartu peringatan **"Akses Waktu Menonton Telah Habis"**, dan menyediakan tombol **"Minta Akses Ulang"**.

---

## 2. Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components & Route Handlers)
- **Language**: TypeScript (Strict Mode)
- **Database & ORM**: PostgreSQL (v14+) + Prisma ORM v6 (`prisma@^6`)
- **Authentication**: `jose` (Edge-compatible JWT HS256) + `bcryptjs`
- **Styling & UI Components**: Tailwind CSS v4 + `shadcn/ui` + `lucide-react` + `sonner`
- **Storage**: Local Private Server File System (`storage/videos/` dengan proteksi `path.basename()`)

---

## 3. Arsitektur Database & ERD

Database menggunakan 4 tabel ternormalisasi di PostgreSQL (`users`, `videos`, `access_requests`, dan `video_permissions`) dengan relasi `ON DELETE CASCADE` dan dukungan *soft delete* (`deletedAt`).

```mermaid
erDiagram
    users ||--o{ access_requests : "mengajukan"
    users ||--o{ video_permissions : "memiliki"
    videos ||--o{ access_requests : "diminta pada"
    videos ||--o{ video_permissions : "diizinkan pada"
    access_requests |o--o| video_permissions : "menghasilkan"

    users {
        string id PK "cuid()"
        string name
        string email UK "Unique"
        string passwordHash
        enum role "ADMIN | CUSTOMER"
        datetime createdAt
        datetime updatedAt
        datetime deletedAt "Nullable (Soft Delete)"
    }

    videos {
        string id PK "cuid()"
        string title
        string description "Nullable"
        string originalName
        string storedFileName UK "UUID.ext in storage/videos/"
        int fileSize "Bytes"
        string mimeType "video/mp4 | video/webm | video/ogg"
        datetime createdAt
        datetime updatedAt
        datetime deletedAt "Nullable (Soft Delete)"
    }

    access_requests {
        string id PK "cuid()"
        string userId FK
        string videoId FK
        enum status "PENDING | APPROVED | REJECTED"
        string note "Nullable"
        int requestedDurationMinutes "Nullable"
        int grantedDurationMinutes "Nullable"
        datetime requestedAt
        datetime reviewedAt "Nullable"
    }

    video_permissions {
        string id PK "cuid()"
        string userId FK
        string videoId FK
        string requestId FK "Unique, Nullable (Direct Grant)"
        int durationMinutes "Default 60"
        datetime grantedAt
        datetime startedAt "Nullable (Lazy-Start on First Watch)"
        datetime expiresAt "Nullable (Set on First Watch)"
        datetime revokedAt "Nullable"
    }
```

### Penjelasan 4 Tabel Utama
1. **`users`**: Menyimpan data akun `ADMIN` dan `CUSTOMER`, hash password (`bcryptjs`), serta `deletedAt` untuk *soft delete*.
2. **`videos`**: Menyimpan metadata video, nama file fisik (`storedFileName`) yang tersimpan secara privat di `storage/videos/`, serta `deletedAt` untuk pengarsipan (*soft delete*).
3. **`access_requests`**: Mencatat setiap permohonan akses menonton dari customer (`PENDING`, `APPROVED`, `REJECTED`) beserta catatan dan durasi yang disetujui untuk jejak audit (*audit trail*).
4. **`video_permissions`**: Menyimpan hak akses menonton beserta `durationMinutes`, waktu mulai menonton (`startedAt`), waktu kedaluwarsa (`expiresAt`), dan status pencabutan (`revokedAt`). Kolom `requestId` bersifat *nullable* agar Admin dapat memberikan akses via persetujuan request maupun secara langsung (*Bulk Direct Grant*).

---

## 4. Alur Kerja Sistem (End-to-End Workflow)

```mermaid
sequenceDiagram
    actor Admin
    actor Customer
    participant App as Next.js Server & API
    participant DB as PostgreSQL
    participant Disk as Private Storage (storage/videos/)

    Admin->>App: 1. Buat akun Customer & Upload Video fisik
    App->>Disk: Simpan file UUID.mp4 di storage/videos/
    App->>DB: Simpan record User & Video

    Customer->>App: 2. Login & klik "Minta Akses Menonton"
    App->>DB: Buat AccessRequest (status = PENDING)

    Admin->>App: 3. Setujui Request / Bulk Direct Grant (misal: 1 Menit)
    App->>DB: Transaksi: Update Request (APPROVED) & Buat VideoPermission (durationMinutes = 1, startedAt = NULL, expiresAt = NULL)

    Customer->>App: 4. Buka /dashboard/watch/[id] (First Watch)
    App->>DB: Mulai timer (startedAt = now, expiresAt = now + 1m)
    App->>Disk: Stream byte range (HTTP 206 Partial Content, Cache-Control: no-store)
    Disk-->>Customer: Video terputar + Live Countdown Timer (HH:MM:SS)

    Note over Customer,App: 5. Waktu Habis (Countdown = 00:00:00)
    Customer->>Customer: Otomatis pause(), hapus src, load() (flush buffer) & unmount player
    Customer->>App: Klik "Minta Akses Ulang"
    App->>DB: Buat AccessRequest baru (status = PENDING)
```

---

## 5. Panduan Instalasi Lokal & Import `database.sql`

### Prasyarat
- **Node.js** v20+
- **PostgreSQL** v14+

### Langkah 1: Clone & Install Dependencies
```bash
git clone <repository-url>
cd TESTAPP-MEDIATAMA
npm install
```
> Script `postinstall` di `package.json` akan otomatis menjalankan `prisma generate` sehingga Prisma Client langsung siap dipakai.

### Langkah 2: Konfigurasi Environment Variable
Salin file `.env.example` menjadi `.env` dan sesuaikan kredensial PostgreSQL lokal Anda:
```bash
cp .env.example .env
```
Isi `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/mediatama_test?schema=public"
JWT_SECRET="replace-with-strong-secret-key-at-least-32-chars"
```

### Langkah 3: Setup Database (Pilih Opsi A atau Opsi B)

#### Opsi A — Import Langsung File `database.sql` (Cepat & Kompatibel PostgreSQL 14+)
Buat database kosong `mediatama_test`, lalu import `database.sql` yang sudah berisi struktur 4 tabel lengkap beserta 3 akun seed default:
```bash
createdb -U postgres mediatama_test
psql -U postgres -d mediatama_test -f database.sql
```

#### Opsi B — Menggunakan Prisma Migrate & Seed
```bash
npx prisma migrate deploy
npx prisma db seed
```

### Langkah 4: Jalankan Aplikasi
```bash
npm run dev
```
Buka `http://localhost:3000` di browser.

---

## 6. Akun Demo & Skenario Testing Cepat (1 Menit)

### Daftar Akun Demo (Bawaan Seed & `database.sql`)

| Role | Email | Password | Halaman Utama |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@mediatama.test` | `admin123` | `/admin` |
| **CUSTOMER 1** | `customer1@mediatama.test` | `customer123` | `/dashboard` |
| **CUSTOMER 2** | `customer2@mediatama.test` | `customer123` | `/dashboard` |

### Skenario Testing Cepat (Simulasi Kedaluwarsa 1 Menit)
1. **Login sebagai Admin** (`admin@mediatama.test` / `admin123`).
2. Buka menu **Videos** (`/admin/videos`), klik **Upload Video**, lalu unggah sebuah file video `.mp4` (maks. 100MB).
3. Buka jendela *Incognito* (atau logout) dan **Login sebagai Customer 1** (`customer1@mediatama.test` / `customer123`).
4. Pada katalog `/dashboard`, video berstatus **"Belum Ada Akses"**. Klik **"Minta Akses Menonton"** dan kirim permintaan. Status berubah menjadi **"Menunggu Konfirmasi Admin"**.
5. Kembali ke akun **Admin**, buka menu **Access Requests** (`/admin/requests`).
6. Klik tombol **"Setujui"** pada permintaan Customer 1, pilih preset **"1 Menit (Testing)"**, lalu klik **"Setujui & Aktifkan Akses"**.
7. Kembali ke layar **Customer 1** (`/dashboard`), klik **Refresh Status**. Status video kini **"Akses Aktif"** (timer belum berkurang sebelum video dibuka). Klik **"Tonton Video"**.
8. Di halaman `/dashboard/watch/[id]`, timer hitung mundur `00:01:00` mulai berjalan, video terputar dengan dukungan *seeking* (`206 Partial Content`).
9. Tunggu hingga timer mencapai `00:00:00` (1 menit):
   - Video otomatis berhenti, *buffer* dibersihkan, dan pemutar digantikan oleh kartu **"Akses Waktu Menonton Telah Habis"**.
   - Endpoint `/api/videos/<id>/stream` otomatis mengembalikan `403 Forbidden`.
   - Klik **"Minta Akses Ulang"** untuk mengajukan permohonan baru ke Admin.
