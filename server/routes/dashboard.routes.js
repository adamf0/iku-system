const express = require('express');
const db = require('../data/db');
const { authRequired, scopeUnits } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const TRIWULAN = ['TW1', 'TW2', 'TW3', 'TW4'];

function scopedCapaian(req, filters = {}) {
  const scope = scopeUnits(req.user);
  let data = db.get('capaian').value().filter(c => scope.includes(c.kode_unit));
  if (filters.tahun) data = data.filter(c => Number(c.tahun) === Number(filters.tahun));
  return data;
}

// -------- RINGKASAN UTAMA (kartu statistik + capaian per IKU triwulan terakhir tersedia) --------
router.get('/summary', (req, res) => {
  const tahun = Number(req.query.tahun) || new Date().getFullYear();
  const data = scopedCapaian(req, { tahun });
  const ikuList = db.get('mst_iku').filter(i => !i.induk_iku).value();

  const statusCount = { DRAFT: 0, DIAJUKAN: 0, DIVERIFIKASI: 0, DISAHKAN: 0, DITOLAK: 0 };
  data.forEach(c => { statusCount[c.status_validasi] = (statusCount[c.status_validasi] || 0) + 1; });

  // Ambil capaian TERSAHKAN terbaru per (kode_iku) - agregasi rata-rata seluruh unit dalam scope
  const perIku = ikuList.map(iku => {
    const rows = data.filter(c => c.kode_iku === iku.kode_iku && c.status_validasi === 'DISAHKAN');
    // ambil triwulan terakhir yang tersedia
    let latestTw = null;
    TRIWULAN.slice().reverse().forEach(tw => {
      if (!latestTw && rows.some(r => r.triwulan === tw)) latestTw = tw;
    });
    const rowsLatest = latestTw ? rows.filter(r => r.triwulan === latestTw) : [];
    const rataCapaian = rowsLatest.length
      ? Number((rowsLatest.reduce((s, r) => s + r.nilai_capaian, 0) / rowsLatest.length).toFixed(2))
      : null;
    const target = rowsLatest.length ? rowsLatest[0].target_capaian : null;
    return {
      kode_iku: iku.kode_iku,
      nama_indikator: iku.nama_indikator,
      sifat: iku.sifat,
      satuan: iku.satuan,
      triwulan_terakhir: latestTw,
      capaian_rata: rataCapaian,
      target,
      status: rataCapaian === null ? 'BELUM ADA DATA SAH' : (rataCapaian >= target ? 'TERCAPAI' : 'BELUM TERCAPAI')
    };
  });

  const totalTercapai = perIku.filter(x => x.status === 'TERCAPAI').length;
  const totalAdaData = perIku.filter(x => x.capaian_rata !== null).length;

  res.json({
    tahun,
    total_unit_terpantau: scopeUnits(req.user).length,
    total_iku_dipantau: ikuList.length,
    total_laporan: data.length,
    status_count: statusCount,
    persentase_iku_tercapai: totalAdaData ? Number(((totalTercapai / totalAdaData) * 100).toFixed(1)) : 0,
    per_iku: perIku
  });
});

// -------- TREND PER TRIWULAN untuk satu IKU (line chart) --------
router.get('/trend/:kode_iku', (req, res) => {
  const tahun = Number(req.query.tahun) || new Date().getFullYear();
  const kode_iku = req.params.kode_iku;
  const data = scopedCapaian(req, { tahun }).filter(c => c.kode_iku === kode_iku && c.status_validasi === 'DISAHKAN');

  const trend = TRIWULAN.map(tw => {
    const rows = data.filter(c => c.triwulan === tw);
    const rata = rows.length ? Number((rows.reduce((s, r) => s + r.nilai_capaian, 0) / rows.length).toFixed(2)) : null;
    const target = rows.length ? rows[0].target_capaian : null;
    return { triwulan: tw, capaian: rata, target };
  });
  res.json({ kode_iku, tahun, trend });
});

// -------- REKAP MATRIKS: unit x IKU (untuk tabel & heatmap) --------
router.get('/rekap-matriks', (req, res) => {
  const tahun = Number(req.query.tahun) || new Date().getFullYear();
  const triwulan = req.query.triwulan || 'TW4';
  const data = scopedCapaian(req, { tahun }).filter(c => c.triwulan === triwulan);

  const scope = scopeUnits(req.user);
  const units = db.get('units').value().filter(u => scope.includes(u.kode_unit) && ['S1', 'S2', 'S3', 'D3', 'D4', 'PROFESI'].includes(u.jenjang) || scope.includes(u.kode_unit) && u.jenjang === 'LEMBAGA');
  const unitsToShow = db.get('units').value().filter(u => scope.includes(u.kode_unit));
  const ikuList = db.get('mst_iku').filter(i => !i.induk_iku).value();

  const matriks = unitsToShow.map(u => {
    const row = { kode_unit: u.kode_unit, nama_unit: u.nama_unit, jenjang: u.jenjang, nilai: {} };
    ikuList.forEach(iku => {
      const found = data.find(c => c.kode_unit === u.kode_unit && c.kode_iku === iku.kode_iku);
      row.nilai[iku.kode_iku] = found ? { capaian: found.nilai_capaian, target: found.target_capaian, status: found.status_validasi } : null;
    });
    return row;
  });

  res.json({ tahun, triwulan, iku_columns: ikuList.map(i => ({ kode_iku: i.kode_iku, nama: i.nama_indikator })), matriks });
});

// -------- ANTREAN VERIFIKASI (khusus LPM/Admin) --------
router.get('/antrean-verifikasi', (req, res) => {
  if (!['LPM', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Hanya LPM/Admin yang dapat mengakses antrean verifikasi.' });
  const data = db.get('capaian').value().filter(c => c.status_validasi === 'DIAJUKAN');
  const unitMap = {}; db.get('units').value().forEach(u => unitMap[u.kode_unit] = u.nama_unit);
  const ikuMap = {}; db.get('mst_iku').value().forEach(i => ikuMap[i.kode_iku] = i.nama_indikator);
  res.json(data.map(c => ({ ...c, nama_unit: unitMap[c.kode_unit], nama_iku: ikuMap[c.kode_iku] })));
});

// -------- STATUS KELENGKAPAN PELAPORAN PER UNIT & TRIWULAN --------
router.get('/kelengkapan', (req, res) => {
  const tahun = Number(req.query.tahun) || new Date().getFullYear();
  const scope = scopeUnits(req.user);
  const units = db.get('units').value().filter(u => scope.includes(u.kode_unit) && u.kode_unit !== 'UNPAK');
  const ikuWajib = db.get('mst_iku').value().filter(i => !i.induk_iku && String(i.sifat).includes('WAJIB'));
  const data = db.get('capaian').value().filter(c => scope.includes(c.kode_unit) && Number(c.tahun) === tahun);

  const result = units.map(u => {
    const perTw = {};
    TRIWULAN.forEach(tw => {
      const expected = ikuWajib.length;
      const filled = data.filter(c => c.kode_unit === u.kode_unit && c.triwulan === tw && c.status_validasi !== 'DITOLAK').length;
      perTw[tw] = { terisi: filled, total: expected, persen: expected ? Math.round((filled / expected) * 100) : 0 };
    });
    return { kode_unit: u.kode_unit, nama_unit: u.nama_unit, per_triwulan: perTw };
  });
  res.json({ tahun, ikuWajibCount: ikuWajib.length, data: result });
});

module.exports = router;
