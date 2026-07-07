// Seed data awal sistem: master IKU, bobot kriteria, unit kerja, dan pengguna (5 level akses)
const db = require('../data/db');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const extracted = require('../data/extracted_iku.json');

function resetAll() {
  db.set('users', []).write();
  db.set('units', []).write();
  db.set('mst_iku', []).write();
  db.set('mst_bobot', []).write();
  db.set('capaian', []).write();
  db.set('rincian', []).write();
  db.set('bukti', []).write();
  db.set('log_aktivitas', []).write();
}

// ---------- 1. MASTER IKU ----------
function seedMstIku() {
  const formulaMap = {};
  extracted.formula.forEach(r => { formulaMap[r[0]] = { formula: r[1], variabel: r[2], sumber: r[3], satuan: r[4] }; });

  const arahRendah = new Set(['IKU 11.3']);

  const iku = extracted.ringkasan.map(r => {
    const kode = r[1];
    const f = formulaMap[kode] || {};
    return {
      kode_iku: kode,
      nama_indikator: r[3],
      sasaran_strategis: r[2],
      sifat: r[4],
      satuan: r[5] || f.satuan || '%',
      kelompok: r[6],
      formula_text: f.formula || '-',
      variabel_kunci: f.variabel || '-',
      sumber_data: f.sumber || '-',
      arah_penilaian: arahRendah.has(kode) ? 'MAKIN_RENDAH_MAKIN_BAIK' : 'MAKIN_TINGGI_MAKIN_BAIK',
      berbasis_rasio: !['Dokumen', 'Opini', 'Predikat', 'Unit Kerja', 'Laporan'].includes(r[5]),
      is_active: true
    };
  });

  // Tambahkan sub-indikator sebagai entri IKU turunan (opsional dipantau terpisah)
  const subIku = extracted.sub.map(r => ({
    kode_iku: r[1],
    nama_indikator: r[2],
    sasaran_strategis: 'Sub-Indikator',
    sifat: 'PENDUKUNG',
    satuan: r[5] || '%',
    kelompok: 'Sub-Indikator',
    formula_text: r[3],
    variabel_kunci: r[4] || '-',
    sumber_data: '-',
    arah_penilaian: 'MAKIN_TINGGI_MAKIN_BAIK',
    induk_iku: r[0],
    berbasis_rasio: true,
    is_active: true
  }));

  db.set('mst_iku', [...iku, ...subIku]).write();
  console.log(`Master IKU tersimpan: ${iku.length} IKU utama + ${subIku.length} sub-indikator`);
}

// ---------- 2. MASTER BOBOT KRITERIA ----------
function seedBobot() {
  const rows = extracted.kriteria.map((r, i) => ({
    id_bobot: i + 1,
    kode_iku: r[0],
    komponen: r[1],
    kondisi: r[2],
    catatan_level: r[3],
    nilai_bobot: r[4],
    keterangan: r[5],
    tahun_berlaku: 2026
  }));
  db.set('mst_bobot', rows).write();
  console.log(`Bobot kriteria tersimpan: ${rows.length} baris`);
}

// ---------- 3. UNIT KERJA (struktur organisasi UNPAK - contoh representatif) ----------
function seedUnits() {
  const units = [
    { kode_unit: 'UNPAK', nama_unit: 'Universitas Pakuan (Institusi)', jenjang: 'INSTITUSI', unit_induk: null },
    { kode_unit: 'LPM', nama_unit: 'Lembaga Penjaminan Mutu', jenjang: 'LEMBAGA', unit_induk: 'UNPAK' },
    { kode_unit: 'LPPM', nama_unit: 'Lembaga Penelitian & Pengabdian Masyarakat', jenjang: 'LEMBAGA', unit_induk: 'UNPAK' },
    { kode_unit: 'BAAK', nama_unit: 'Biro Administrasi Akademik & Kemahasiswaan', jenjang: 'UNIT_KERJA', unit_induk: 'UNPAK' },
    { kode_unit: 'BKAU', nama_unit: 'Biro Keuangan & Aset Universitas', jenjang: 'UNIT_KERJA', unit_induk: 'UNPAK' },

    { kode_unit: 'FT', nama_unit: 'Fakultas Teknik', jenjang: 'FAKULTAS', unit_induk: 'UNPAK' },
    { kode_unit: 'FT-TI', nama_unit: 'Program Studi Teknik Informatika', jenjang: 'S1', unit_induk: 'FT' },
    { kode_unit: 'FT-TS', nama_unit: 'Program Studi Teknik Sipil', jenjang: 'S1', unit_induk: 'FT' },
    { kode_unit: 'FT-TE', nama_unit: 'Program Studi Teknik Elektro', jenjang: 'S1', unit_induk: 'FT' },

    { kode_unit: 'FEB', nama_unit: 'Fakultas Ekonomi dan Bisnis', jenjang: 'FAKULTAS', unit_induk: 'UNPAK' },
    { kode_unit: 'FEB-MNJ', nama_unit: 'Program Studi Manajemen', jenjang: 'S1', unit_induk: 'FEB' },
    { kode_unit: 'FEB-AKT', nama_unit: 'Program Studi Akuntansi', jenjang: 'S1', unit_induk: 'FEB' },

    { kode_unit: 'FMIPA', nama_unit: 'Fakultas Matematika dan Ilmu Pengetahuan Alam', jenjang: 'FAKULTAS', unit_induk: 'UNPAK' },
    { kode_unit: 'FMIPA-BIO', nama_unit: 'Program Studi Biologi', jenjang: 'S1', unit_induk: 'FMIPA' },
    { kode_unit: 'FMIPA-MTK', nama_unit: 'Program Studi Matematika', jenjang: 'S1', unit_induk: 'FMIPA' },

    { kode_unit: 'PASCA', nama_unit: 'Sekolah Pascasarjana', jenjang: 'FAKULTAS', unit_induk: 'UNPAK' },
    { kode_unit: 'PASCA-MM', nama_unit: 'Program Studi Magister Manajemen', jenjang: 'S2', unit_induk: 'PASCA' }
  ];
  db.set('units', units).write();
  console.log(`Unit kerja tersimpan: ${units.length}`);
  return units;
}

// ---------- 4. PENGGUNA (5 level akses) ----------
function seedUsers() {
  const hash = (p) => bcrypt.hashSync(p, 8);
  const users = [
    { id: uuid(), username: 'admin', password: hash('admin123'), nama: 'Administrator Sistem', role: 'ADMIN', kode_unit: 'UNPAK', email: 'admin@unpak.ac.id' },
    { id: uuid(), username: 'lpm', password: hash('lpm123'), nama: 'Kepala Lembaga Penjaminan Mutu', role: 'LPM', kode_unit: 'LPM', email: 'lpm@unpak.ac.id' },
    { id: uuid(), username: 'fakultas_ft', password: hash('fakultas123'), nama: 'Wakil Dekan I - Fakultas Teknik', role: 'FAKULTAS', kode_unit: 'FT', email: 'wadek1.ft@unpak.ac.id' },
    { id: uuid(), username: 'fakultas_feb', password: hash('fakultas123'), nama: 'Wakil Dekan I - Fakultas Ekonomi dan Bisnis', role: 'FAKULTAS', kode_unit: 'FEB', email: 'wadek1.feb@unpak.ac.id' },
    { id: uuid(), username: 'prodi_ti', password: hash('prodi123'), nama: 'Ketua Program Studi Teknik Informatika', role: 'PRODI', kode_unit: 'FT-TI', email: 'kaprodi.ti@unpak.ac.id' },
    { id: uuid(), username: 'prodi_ts', password: hash('prodi123'), nama: 'Ketua Program Studi Teknik Sipil', role: 'PRODI', kode_unit: 'FT-TS', email: 'kaprodi.ts@unpak.ac.id' },
    { id: uuid(), username: 'prodi_mnj', password: hash('prodi123'), nama: 'Ketua Program Studi Manajemen', role: 'PRODI', kode_unit: 'FEB-MNJ', email: 'kaprodi.mnj@unpak.ac.id' },
    { id: uuid(), username: 'unit_lppm', password: hash('unit123'), nama: 'Kepala LPPM', role: 'UNIT_KERJA', kode_unit: 'LPPM', email: 'lppm@unpak.ac.id' },
    { id: uuid(), username: 'unit_bkau', password: hash('unit123'), nama: 'Kepala Biro Keuangan & Aset', role: 'UNIT_KERJA', kode_unit: 'BKAU', email: 'bkau@unpak.ac.id' }
  ];
  db.set('users', users).write();
  console.log(`Pengguna tersimpan: ${users.length}`);
}

// ---------- 5. CONTOH DATA CAPAIAN (opsional, agar dashboard tidak kosong saat demo) ----------
function seedContohCapaian() {
  const targetTahunan = {
    'IKU 1': 80, 'IKU 2': 85, 'IKU 3': 30, 'IKU 4': 15, 'IKU 5': 40,
    'IKU 6': 35, 'IKU 7': 90, 'IKU 8': 10, 'IKU 9': 20
  };
  const unitProdi = ['FT-TI', 'FT-TS', 'FEB-MNJ'];
  const triwulanList = ['TW1', 'TW2', 'TW3', 'TW4'];
  const statusByTw = { TW1: 'DISAHKAN', TW2: 'DISAHKAN', TW3: 'DIVERIFIKASI', TW4: 'DRAFT' };

  const rows = [];
  let idc = 1;
  unitProdi.forEach((unit) => {
    Object.keys(targetTahunan).forEach((kode) => {
      let kumulatifPembilang = 0, kumulatifPenyebut = 0;
      triwulanList.forEach((tw, idx) => {
        const target = targetTahunan[kode];
        const basePenyebut = 100 + Math.floor(Math.random() * 50);
        const rasio = Math.max(5, Math.min(95, target + (Math.random() * 20 - 10) - (3 - idx) * 3));
        const pembilang = Math.round((rasio / 100) * basePenyebut);
        rows.push({
          id_capaian: idc++,
          kode_iku: kode,
          kode_unit: unit,
          tahun: 2026,
          triwulan: tw,
          nilai_pembilang: pembilang,
          nilai_penyebut: basePenyebut,
          nilai_capaian: Number(((pembilang / basePenyebut) * 100).toFixed(2)),
          target_capaian: target,
          status_validasi: statusByTw[tw],
          catatan: '',
          diinput_oleh: 'seed',
          tanggal_input: new Date().toISOString(),
          diverifikasi_oleh: statusByTw[tw] !== 'DRAFT' ? 'lpm' : null,
          tanggal_verifikasi: statusByTw[tw] !== 'DRAFT' ? new Date().toISOString() : null
        });
      });
    });
  });
  db.set('capaian', rows).write();
  console.log(`Contoh data capaian (demo) tersimpan: ${rows.length} baris`);
}

function run() {
  resetAll();
  seedMstIku();
  seedBobot();
  seedUnits();
  seedUsers();
  seedContohCapaian();
  console.log('\nSeeding selesai. Akun login yang tersedia:');
  console.log('  ADMIN       -> admin / admin123');
  console.log('  LPM         -> lpm / lpm123');
  console.log('  FAKULTAS    -> fakultas_ft / fakultas123  (Fakultas Teknik)');
  console.log('  PRODI       -> prodi_ti / prodi123        (Teknik Informatika)');
  console.log('  UNIT KERJA  -> unit_lppm / unit123         (LPPM)');
}

run();
