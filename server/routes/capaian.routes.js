const express = require('express');
const db = require('../data/db');
const { authRequired, roleAllowed, scopeUnits } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const TRIWULAN = ['TW1', 'TW2', 'TW3', 'TW4'];
const EDITOR_ROLES = ['PRODI', 'FAKULTAS', 'UNIT_KERJA', 'ADMIN'];

function nextId(collectionName) {
  const all = db.get(collectionName).value();
  return all.length ? Math.max(...all.map(x => x.id_capaian || x.id_rincian || x.id_bukti || 0)) + 1 : 1;
}

function hitungCapaian(pembilang, penyebut) {
  const p = Number(pembilang) || 0;
  const q = Number(penyebut) || 0;
  if (q === 0) return 0;
  return Number(((p / q) * 100).toFixed(2));
}

function canAccessUnit(req, kode_unit) {
  const scope = scopeUnits(req.user);
  return scope.includes(kode_unit);
}

// ---------------- LIST / FILTER ----------------
router.get('/', (req, res) => {
  const { tahun, triwulan, kode_iku, kode_unit, status } = req.query;
  const scope = scopeUnits(req.user);
  let data = db.get('capaian').value().filter(c => scope.includes(c.kode_unit));

  if (tahun) data = data.filter(c => String(c.tahun) === String(tahun));
  if (triwulan) data = data.filter(c => c.triwulan === triwulan);
  if (kode_iku) data = data.filter(c => c.kode_iku === kode_iku);
  if (kode_unit) data = data.filter(c => c.kode_unit === kode_unit);
  if (status) data = data.filter(c => c.status_validasi === status);

  const ikuMap = {};
  db.get('mst_iku').value().forEach(i => { ikuMap[i.kode_iku] = i; });
  const unitMap = {};
  db.get('units').value().forEach(u => { unitMap[u.kode_unit] = u; });

  const enriched = data.map(c => ({
    ...c,
    nama_iku: ikuMap[c.kode_iku] ? ikuMap[c.kode_iku].nama_indikator : c.kode_iku,
    satuan: ikuMap[c.kode_iku] ? ikuMap[c.kode_iku].satuan : '',
    nama_unit: unitMap[c.kode_unit] ? unitMap[c.kode_unit].nama_unit : c.kode_unit
  }));

  res.json(enriched.sort((a, b) => b.tahun - a.tahun || TRIWULAN.indexOf(a.triwulan) - TRIWULAN.indexOf(b.triwulan)));
});

// ---------------- DETAIL ----------------
router.get('/:id', (req, res) => {
  const item = db.get('capaian').find({ id_capaian: Number(req.params.id) }).value();
  if (!item) return res.status(404).json({ error: 'Data capaian tidak ditemukan' });
  if (!canAccessUnit(req, item.kode_unit)) return res.status(403).json({ error: 'Tidak memiliki akses ke unit ini' });

  const rincian = db.get('rincian').filter({ id_capaian: item.id_capaian }).value();
  const bukti = db.get('bukti').filter({ id_capaian: item.id_capaian }).value();
  res.json({ ...item, rincian, bukti });
});

// ---------------- CREATE / UPSERT (DRAFT) ----------------
router.post('/', roleAllowed(...EDITOR_ROLES), (req, res) => {
  const { kode_iku, kode_unit, tahun, triwulan, nilai_pembilang, nilai_penyebut, target_capaian, catatan } = req.body || {};

  if (!kode_iku || !kode_unit || !tahun || !triwulan) {
    return res.status(400).json({ error: 'kode_iku, kode_unit, tahun, dan triwulan wajib diisi.' });
  }
  if (!TRIWULAN.includes(triwulan)) return res.status(400).json({ error: 'Triwulan harus salah satu dari TW1, TW2, TW3, TW4.' });
  if (!db.get('mst_iku').find({ kode_iku }).value()) return res.status(400).json({ error: 'Kode IKU tidak dikenal.' });
  if (!canAccessUnit(req, kode_unit)) return res.status(403).json({ error: 'Anda tidak berwenang melaporkan atas nama unit ini.' });

  const existing = db.get('capaian').find({ kode_iku, kode_unit, tahun: Number(tahun), triwulan }).value();

  if (existing && !['DRAFT', 'DITOLAK'].includes(existing.status_validasi)) {
    return res.status(409).json({ error: `Data sudah berstatus ${existing.status_validasi}. Tidak dapat diubah langsung, ajukan revisi melalui LPM.` });
  }

  const nilai_capaian = hitungCapaian(nilai_pembilang, nilai_penyebut);
  const payload = {
    kode_iku, kode_unit, tahun: Number(tahun), triwulan,
    nilai_pembilang: Number(nilai_pembilang) || 0,
    nilai_penyebut: Number(nilai_penyebut) || 0,
    nilai_capaian,
    target_capaian: Number(target_capaian) || (existing ? existing.target_capaian : 0),
    status_validasi: 'DRAFT',
    catatan: catatan || '',
    diinput_oleh: req.user.username,
    tanggal_input: new Date().toISOString(),
    diverifikasi_oleh: null,
    tanggal_verifikasi: null,
    alasan_penolakan: null
  };

  if (existing) {
    db.get('capaian').find({ id_capaian: existing.id_capaian }).assign(payload).write();
    return res.json({ ...existing, ...payload, message: 'Data capaian diperbarui (status DRAFT).' });
  } else {
    const id_capaian = nextId('capaian');
    const row = { id_capaian, ...payload };
    db.get('capaian').push(row).write();
    return res.status(201).json({ ...row, message: 'Data capaian baru tersimpan (status DRAFT).' });
  }
});

// ---------------- SUBMIT (DRAFT/DITOLAK -> DIAJUKAN) ----------------
router.post('/:id/submit', roleAllowed(...EDITOR_ROLES), (req, res) => {
  const item = db.get('capaian').find({ id_capaian: Number(req.params.id) }).value();
  if (!item) return res.status(404).json({ error: 'Data tidak ditemukan' });
  if (!canAccessUnit(req, item.kode_unit)) return res.status(403).json({ error: 'Tidak memiliki akses ke unit ini' });
  if (!['DRAFT', 'DITOLAK'].includes(item.status_validasi)) {
    return res.status(409).json({ error: `Tidak dapat mengajukan data berstatus ${item.status_validasi}.` });
  }
  db.get('capaian').find({ id_capaian: item.id_capaian }).assign({
    status_validasi: 'DIAJUKAN', alasan_penolakan: null, tanggal_input: new Date().toISOString()
  }).write();
  res.json({ message: 'Data berhasil diajukan untuk verifikasi LPM.' });
});

// ---------------- VERIFIKASI (LPM/ADMIN): DIAJUKAN -> DIVERIFIKASI atau DITOLAK ----------------
router.post('/:id/verify', roleAllowed('LPM', 'ADMIN'), (req, res) => {
  const { action, catatan } = req.body || {}; // action: 'APPROVE' | 'REJECT'
  const item = db.get('capaian').find({ id_capaian: Number(req.params.id) }).value();
  if (!item) return res.status(404).json({ error: 'Data tidak ditemukan' });
  if (item.status_validasi !== 'DIAJUKAN') return res.status(409).json({ error: 'Hanya data berstatus DIAJUKAN yang dapat diverifikasi.' });

  if (action === 'APPROVE') {
    db.get('capaian').find({ id_capaian: item.id_capaian }).assign({
      status_validasi: 'DIVERIFIKASI',
      diverifikasi_oleh: req.user.username,
      tanggal_verifikasi: new Date().toISOString(),
      alasan_penolakan: null
    }).write();
    return res.json({ message: 'Data disetujui dan berstatus DIVERIFIKASI.' });
  } else if (action === 'REJECT') {
    db.get('capaian').find({ id_capaian: item.id_capaian }).assign({
      status_validasi: 'DITOLAK',
      diverifikasi_oleh: req.user.username,
      tanggal_verifikasi: new Date().toISOString(),
      alasan_penolakan: catatan || 'Data tidak memenuhi ketentuan / bukti kurang lengkap.'
    }).write();
    return res.json({ message: 'Data dikembalikan ke unit pelapor untuk revisi.' });
  }
  return res.status(400).json({ error: "Parameter 'action' harus APPROVE atau REJECT." });
});

// ---------------- SAHKAN (LPM/ADMIN): DIVERIFIKASI -> DISAHKAN ----------------
router.post('/:id/sahkan', roleAllowed('LPM', 'ADMIN'), (req, res) => {
  const item = db.get('capaian').find({ id_capaian: Number(req.params.id) }).value();
  if (!item) return res.status(404).json({ error: 'Data tidak ditemukan' });
  if (item.status_validasi !== 'DIVERIFIKASI') return res.status(409).json({ error: 'Hanya data berstatus DIVERIFIKASI yang dapat disahkan.' });

  db.get('capaian').find({ id_capaian: item.id_capaian }).assign({
    status_validasi: 'DISAHKAN', tanggal_pengesahan: new Date().toISOString(), disahkan_oleh: req.user.username
  }).write();
  res.json({ message: 'Data resmi DISAHKAN sebagai capaian final periode ini.' });
});

// ---------------- DELETE (hanya DRAFT, unit sendiri / admin) ----------------
router.delete('/:id', roleAllowed(...EDITOR_ROLES), (req, res) => {
  const item = db.get('capaian').find({ id_capaian: Number(req.params.id) }).value();
  if (!item) return res.status(404).json({ error: 'Data tidak ditemukan' });
  if (!canAccessUnit(req, item.kode_unit)) return res.status(403).json({ error: 'Tidak memiliki akses ke unit ini' });
  if (item.status_validasi !== 'DRAFT') return res.status(409).json({ error: 'Hanya data berstatus DRAFT yang dapat dihapus.' });
  db.get('capaian').remove({ id_capaian: item.id_capaian }).write();
  res.json({ message: 'Data draft dihapus.' });
});

// ---------------- RINCIAN (data pendukung entitas individual) ----------------
router.post('/:id/rincian', roleAllowed(...EDITOR_ROLES), (req, res) => {
  const item = db.get('capaian').find({ id_capaian: Number(req.params.id) }).value();
  if (!item) return res.status(404).json({ error: 'Data capaian tidak ditemukan' });
  if (!canAccessUnit(req, item.kode_unit)) return res.status(403).json({ error: 'Tidak memiliki akses ke unit ini' });

  const { entitas_id, kriteria_terpenuhi, bobot_diterapkan } = req.body || {};
  const id_rincian = nextId('rincian');
  const row = {
    id_rincian, id_capaian: item.id_capaian,
    entitas_id: entitas_id || '-',
    kriteria_terpenuhi: kriteria_terpenuhi || '-',
    bobot_diterapkan: Number(bobot_diterapkan) || 0,
    kontribusi_nilai: Number(bobot_diterapkan) || 0,
    dicatat_oleh: req.user.username,
    tanggal: new Date().toISOString()
  };
  db.get('rincian').push(row).write();
  res.status(201).json(row);
});

router.get('/:id/rincian', (req, res) => {
  const item = db.get('capaian').find({ id_capaian: Number(req.params.id) }).value();
  if (!item) return res.status(404).json({ error: 'Data tidak ditemukan' });
  if (!canAccessUnit(req, item.kode_unit)) return res.status(403).json({ error: 'Tidak memiliki akses' });
  res.json(db.get('rincian').filter({ id_capaian: item.id_capaian }).value());
});

// ---------------- BUKTI DUKUNG ----------------
router.post('/:id/bukti', roleAllowed(...EDITOR_ROLES), (req, res) => {
  const item = db.get('capaian').find({ id_capaian: Number(req.params.id) }).value();
  if (!item) return res.status(404).json({ error: 'Data capaian tidak ditemukan' });
  if (!canAccessUnit(req, item.kode_unit)) return res.status(403).json({ error: 'Tidak memiliki akses ke unit ini' });

  const { jenis_dokumen, file_url } = req.body || {};
  if (!jenis_dokumen || !file_url) return res.status(400).json({ error: 'jenis_dokumen dan file_url wajib diisi' });

  const id_bukti = nextId('bukti');
  const row = {
    id_bukti, id_capaian: item.id_capaian, jenis_dokumen, file_url,
    diunggah_oleh: req.user.username, tanggal_unggah: new Date().toISOString()
  };
  db.get('bukti').push(row).write();
  res.status(201).json(row);
});

module.exports = router;
