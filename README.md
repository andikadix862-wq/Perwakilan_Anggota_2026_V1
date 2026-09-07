# Sistem Pemilihan Anggota Perwakilan Online KOPSYAH YKK AP Indonesia (Periode 2026)

Aplikasi web resmi pemungutan suara elektronik (e-voting) untuk pemilihan anggota perwakilan Koperasi Karyawan Syariah (KOPSYAH) PT YKK AP Indonesia Periode 2026.

---

## 1. Fitur Utama & Kepatuhan PRD

1. **Prinsip Satu Anggota Satu Suara (One Member One Vote):**
   - Validasi ketat di sisi server/backend dengan concurrency lock (`votingLocks`) untuk mencegah double voting.
   - Pilihan dienkripsi dan status suara langsung dikunci.
2. **Keterwakilan Berdasarkan Bagian / Divisi:**
   - Anggota hanya dapat melihat dan memilih calon perwakilan dari bagian/divisinya sendiri.
   - Pemilihan lintas bagian diblokir secara mutlak pada level database dan API.
3. **Penentuan Kuota Kursi Otomatis (Rasio 10:1):**
   - Formula: `Kuota = Jumlah Anggota / 10`
   - Sisa desimal `0.1 s/d 0.5` dibulatkan ke bawah.
   - Sisa desimal `0.6 s/d 0.9` dibulatkan ke atas.
   - Contoh:
     - 5 anggota = 0.5 → 0 kursi
     - 6 anggota = 0.6 → 1 kursi
     - 15 anggota = 1.5 → 1 kursi
     - 16 anggota = 1.6 → 2 kursi
     - 45 anggota = 4.5 → 4 kursi
     - 46 anggota = 4.6 → 5 kursi
4. **Validasi Batas Pensiun Calon Perwakilan (4 Tahun):**
   - Calon tidak boleh memasuki usia pensiun dalam waktu kurang dari `batas_tahun_sebelum_pensiun = 4` tahun.
5. **Bukti Transaksi Digital & Kerahasiaan Suara:**
   - Setelah voting berhasil, pemilih menerima tanda terima resmi ber-ID Transaksi unik (`TX-YKK-...`).
   - Sesuai prinsip kerahasiaan, lembar tanda terima **tidak menampilkan kembali** nama kandidat yang dipilih.
6. **Portal Administrasi & Panitia:**
   - Dasbor real-time dengan metrik partisipasi suara per bagian.
   - Manajemen Master Anggota (pencarian, filter, toggle hak pilih, reset darurat, dan import CSV dengan mekanisme UPSERT).
   - Manajemen Calon Perwakilan (nomor urut, visi-misi, foto profil, dan validasi usia pensiun).
   - Penanganan Suara Seimbang (Tie-Break Resolution) dengan pencatatan Berita Acara.
   - Dokumen Berita Acara Resmi berformat kop KOPSYAH YKK AP Indonesia siap cetak/ekspor.
   - Jejak Audit Keamanan (Audit Logs) tak terhapuskan.
   - Modul Rangkaian Pengujian Otomatis (Test Suite) PRD Pasal 39 langsung dari UI.

---

## 2. Struktur Proyek

```text
├── server/
│   ├── data/
│   │   └── election_store.json    # JSON storage dengan abstraksi persistence layer
│   ├── db.ts                      # Abstraksi database, seed data, CRUD & audit logger
│   ├── quotaService.ts            # Logika perhitungan kuota rasio 10:1
│   ├── votingService.ts           # Mesin validasi pemungutan suara & concurrency lock
│   └── testRunner.ts              # Rangkaian acceptance test otomatis PRD Pasal 39
├── server.ts                      # Express API backend & Vite middleware
├── src/
│   ├── components/
│   │   ├── admin/                 # Modul-modul Portal Administrator & Panitia
│   │   ├── ConfirmationModal.tsx  # 2-step verification modal sebelum kirim suara
│   │   ├── LoginPage.tsx          # Login Google & Presets demo anggota/admin
│   │   ├── Navbar.tsx             # Header aplikasi dengan badge status pemilihan
│   │   ├── VoterDashboard.tsx     # Profil pemilih & informasi alokasi kursi bagian
│   │   ├── VotingPage.tsx         # Surat suara digital & kartu kandidat
│   │   └── VotingSuccessPage.tsx  # Tanda bukti elektronik (Receipt) & Confetti
│   ├── services/
│   │   └── api.ts                 # Strongly-typed API client
│   ├── types.ts                   # Definisi TypeScript interface seluruh sistem
│   ├── App.tsx                    # Komponen utama & state routing
│   └── main.tsx                   # Entry point React
├── package.json
└── metadata.json
```

---

## 3. Menjalankan Aplikasi

### Mode Pengembangan (Development)
```bash
npm run dev
```
Server Express dan Vite akan berjalan pada `http://localhost:3000`.

### Build Produksi
```bash
npm run build
```
Menghasilkan static bundle frontend di `dist/` dan CommonJS bundled backend di `dist/server.cjs`.

### Menjalankan Server Produksi
```bash
npm run start
```

---

## 4. Akun Uji Coba (Demo Accounts)

Sistem telah dilengkapi dengan data anggota dan calon perwakilan terdaftar:

| Nama | Email | Bagian | Kuota Bagian | Role / Catatan |
|---|---|---|---|---|
| **Andika Pratama** | `andikadix862@gmail.com` | Produksi | 5 Kursi | Pemilih Aktif (Belum Memilih) |
| **Budi Santoso** | `budi.santoso@kopsyah-ykk.id` | Produksi | 5 Kursi | Pemilih Aktif |
| **Fajar Nugroho** | `fajar.nugroho@kopsyah-ykk.id` | Engineering | 2 Kursi | Pemilih Aktif |
| **Maya Indah** | `maya.indah@kopsyah-ykk.id` | HR & GA | 1 Kursi | Pemilih Aktif |
| **Eko Prasetyo** | `eko.prasetyo@kopsyah-ykk.id` | Produksi | 5 Kursi | Pemilih yang Sudah Memilih |
| **Karyawan Magang** | `magang@kopsyah-ykk.id` | Produksi | 5 Kursi | Anggota Tanpa Hak Pilih |
| **Administrator** | `admin@kopsyah-ykk.id` | Panitia | - | Super Admin Portal |

---

## 5. Ringkasan API Endpoints

- `POST /api/auth/login`: Autentikasi anggota atau admin.
- `GET /api/voter/dashboard`: Informasi profil pemilih dan kuota bagian.
- `GET /api/voter/candidates`: Daftar calon perwakilan sesuai bagian pemilih.
- `POST /api/voter/submit-vote`: Pengiriman suara dengan validasi hak suara dan locking.
- `GET /api/admin/dashboard`: Statistik agregat dan rekapitulasi partisipasi per bagian.
- `GET /api/admin/members`: Master data anggota dengan filter dan pencarian.
- `POST /api/admin/members/upsert`: Import massal anggota dengan deteksi kolom & update data eksisting.
- `POST /api/admin/members/reset-status`: Reset darurat status voting untuk pengujian.
- `GET /api/admin/results`: Perolehan suara per bagian, ranking, dan status perwakilan terpilih.
- `POST /api/admin/tie-break`: Penyelesaian suara berimbang oleh panitia.
- `GET /api/admin/run-tests`: Menjalankan acceptance test otomatis PRD Pasal 39.

---

Hak Cipta © 2026 Panitia Pemilihan Anggota Perwakilan KOPSYAH YKK AP Indonesia.
