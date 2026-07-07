# Sistem Pelaporan IKU Diktisaintek Berdampak — Universitas Pakuan

Aplikasi web dinamis untuk pengelolaan pelaporan **Indikator Kinerja Utama (IKU) Diktisaintek Berdampak** secara **triwulanan (TW1–TW4)**, dengan alur kerja berjenjang (input → verifikasi → pengesahan), dashboard interaktif, dan skema data yang mengacu langsung pada workbook *Mapping Kriteria, Bobot & Formulasi IKU UNPAK*.

---

## 1. Arsitektur & Framework

| Lapisan | Teknologi | Keterangan |
|---|---|---|
| Backend / API | **Node.js + Express.js** | REST API, autentikasi JWT, RBAC |
| Basis Data | **lowdb (JSON file-based)** | Ringan, tanpa kompilasi native — mudah dipindahkan ke MySQL/PostgreSQL saat produksi (skema sudah dirancang relasional, lihat `server/data/db.js`) |
| Frontend | **HTML5 + Vanilla JS (SPA hash-routing) + Chart.js** | Tanpa build step — langsung jalan di browser, ringan untuk dideploy di server kampus |
| Auth | **JWT (jsonwebtoken) + bcryptjs** | Token 12 jam, role-based access control |

Struktur ini dipilih agar **mudah dijalankan di lingkungan kampus tanpa proses build/compile**, sekaligus tetap "framework-based" (Express) dan siap dikembangkan lebih lanjut (mis. migrasi ke React/Vue di frontend, atau PostgreSQL di backend, tanpa mengubah kontrak API).

### Struktur Folder
```
iku-system/
├── server/
│   ├── index.js                 # entry point Express
│   ├── data/db.js                # koneksi lowdb + skema default
│   ├── data/db.json               # file database (auto-generate saat seed)
│   ├── data/extracted_iku.json    # data master hasil ekstraksi workbook mapping
│   ├── middleware/auth.js         # JWT verify + RBAC + scope unit hirarkis
│   ├── routes/
│   │   ├── auth.routes.js         # login, profil
│   │   ├── master.routes.js       # master IKU, bobot kriteria, unit, users
│   │   ├── capaian.routes.js      # CRUD + alur kerja pelaporan triwulanan
│   │   └── dashboard.routes.js    # agregasi untuk dashboard & visualisasi
│   └── utils/seed.js              # seeding data awal (IKU, bobot, unit, user, contoh capaian)
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js, util.js, app.js         # inti SPA (router, shell, util)
│       └── page-*.js                        # 6 halaman: login, dashboard, input, verifikasi, rekap, master, admin
├── test_e2e.py                    # skrip pengujian end-to-end alur API
├── package.json
└── README.md
```

---

## 2. Levelisasi Pengguna (Role-Based Access Control)

| Role | Cakupan Akses Data | Kewenangan Utama |
|---|---|---|
| **PRODI** | Hanya unit program studinya sendiri | Input & ajukan capaian triwulanan |
| **FAKULTAS** | Fakultasnya + seluruh prodi di bawahnya (hirarkis) | Input & pantau capaian tingkat fakultas dan prodi |
| **UNIT_KERJA** (mis. LPPM, Biro) | Hanya unit kerjanya sendiri | Input & ajukan capaian IKU yang relevan dengan tugasnya |
| **LPM** | Seluruh unit di universitas | Verifikasi, menolak (kembalikan untuk revisi), dan **mengesahkan** data final |
| **ADMIN** | Seluruh unit + hak kelola master data | Semua hak di atas + kelola struktur unit kerja, pengguna, dan master IKU |

Cakupan akses (`scopeUnits`) dihitung otomatis di `server/middleware/auth.js` berdasarkan hirarki `unit_induk`, sehingga Fakultas otomatis "mewarisi" akses baca/lapor atas seluruh Program Studi di bawahnya tanpa konfigurasi manual tambahan.

---

## 3. Alur Kerja Pelaporan Triwulanan

```
DRAFT ──(ajukan)──▶ DIAJUKAN ──(LPM setujui)──▶ DIVERIFIKASI ──(LPM/Admin sahkan)──▶ DISAHKAN
  ▲                     │
  └────(LPM tolak)──────┘   → status DITOLAK, kembali ke unit pelapor untuk revisi → DRAFT
```

- Setiap indikator dilaporkan per kombinasi **(Kode IKU, Kode Unit, Tahun, Triwulan)** — sesuai struktur `trx_capaian_iku` pada workbook mapping.
- Nilai capaian **dihitung otomatis** dari pembilang/penyebut sesuai formula resmi tiap IKU (lihat halaman **Master Kriteria & Bobot**).
- Data yang sudah **DISAHKAN** dikunci — tidak dapat diedit langsung, memastikan integritas data historis per triwulan.
- LPM wajib menyertakan alasan saat menolak data, agar unit pelapor tahu perbaikan yang diperlukan.

---

## 4. Fitur per Halaman

1. **Dashboard** — kartu ringkasan, grafik batang (capaian vs target per IKU), grafik donat (status alur), grafik tren per triwulan (dapat memilih IKU), progress bar kelengkapan pelaporan per unit per TW.
2. **Input Capaian IKU** — formulir dinamis (menampilkan formula & satuan resmi sesuai IKU yang dipilih), preview hasil hitung otomatis, riwayat laporan dengan aksi ajukan/hapus draft.
3. **Verifikasi & Pengesahan** *(LPM/Admin)* — antrean data DIAJUKAN untuk disetujui/ditolak beserta catatan, dan antrean data DIVERIFIKASI untuk disahkan final.
4. **Rekap & Matriks Unit** — heatmap interaktif Unit × IKU per triwulan terpilih (hijau = tercapai, merah = jauh dari target).
5. **Master Kriteria & Bobot** — referensi definisi, kriteria, bobot resmi, formula, dan sub-indikator tiap IKU (bersumber langsung dari workbook mapping).
6. **Administrasi Sistem** *(Admin)* — kelola struktur unit kerja/program studi baru dan lihat daftar pengguna.

---

## 5. Skema Data Inti

Mengikuti rancangan pada sheet `05_Skema_Data_Sistem` workbook mapping:

- `mst_iku` — master 12 IKU utama + sub-indikator turunan (33 entri), termasuk formula & arah penilaian.
- `mst_bobot` — 74 baris kriteria & bobot resmi (mis. bobot kuartil publikasi, bobot posisi lulusan bekerja, dsb.) — ditautkan ke `kode_iku`.
- `units` — struktur organisasi (institusi → fakultas → program studi, serta lembaga/unit kerja).
- `users` — akun pengguna dengan `role` dan `kode_unit`.
- `capaian` — transaksi realisasi per unit/IKU/tahun/triwulan beserta status alur kerja.
- `rincian` — data pendukung entitas individual (opsional, mis. per mahasiswa/dosen/publikasi) untuk audit trail.
- `bukti` — metadata dokumen bukti dukung per laporan.

---

## 6. Instalasi & Menjalankan

```bash
cd iku-system
npm install          # instal dependency (Express, lowdb, JWT, bcrypt, dll — semua pure-JS, tanpa kompilasi native)
npm run seed          # inisialisasi data master IKU, bobot, unit kerja, & akun demo
npm start              # menjalankan server di http://localhost:4000
```

Buka `http://localhost:4000` di browser. Halaman login menyediakan **akun demo** untuk seluruh level akses (klik salah satu baris untuk mengisi otomatis):

| Role | Username | Password |
|---|---|---|
| Administrator | `admin` | `admin123` |
| LPM | `lpm` | `lpm123` |
| Fakultas Teknik | `fakultas_ft` | `fakultas123` |
| Prodi Teknik Informatika | `prodi_ti` | `prodi123` |
| Unit Kerja (LPPM) | `unit_lppm` | `unit123` |

> **Catatan produksi:** Ganti `JWT_SECRET` (env var) dan seluruh password default sebelum digunakan di lingkungan produksi. Untuk skala pengguna besar, migrasikan `lowdb` ke PostgreSQL/MySQL — struktur tabel pada `server/data/db.js` & `server/utils/seed.js` sudah relasional sehingga migrasi hanya mengganti lapisan akses data (repository layer), tanpa mengubah routes/logic bisnis.

### Menguji API (opsional)
```bash
python3 test_e2e.py   # skrip pengujian alur lengkap: login, RBAC, draft→ajukan→verifikasi→sahkan, reject flow, dashboard
```

---

## 7. Pengembangan Lanjutan yang Disarankan

- **Upload bukti dukung riil** (saat ini endpoint `POST /api/capaian/:id/bukti` menerima metadata URL — integrasikan dengan storage seperti S3/MinIO atau file server kampus).
- **Notifikasi email/WhatsApp** otomatis saat status berubah (DIAJUKAN → perlu tindakan LPM; DITOLAK → perlu revisi unit).
- **Ekspor laporan** ke Excel/PDF per periode (dapat memanfaatkan struktur `dashboard.routes.js` sebagai sumber data).
- **Integrasi SSO/SIAKAD** untuk autentikasi pengguna, menggantikan tabel `users` lokal.
- **Audit log lengkap** memanfaatkan koleksi `log_aktivitas` yang sudah disiapkan di skema.
