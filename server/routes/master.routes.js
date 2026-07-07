const express = require('express');
const db = require('../data/db');
const { authRequired, roleAllowed } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// ---- Master IKU ----
router.get('/iku', (req, res) => {
  const { sifat, kelompok, induk } = req.query;
  let data = db.get('mst_iku').value();
  if (sifat) data = data.filter(x => x.sifat === sifat);
  if (kelompok) data = data.filter(x => x.kelompok === kelompok);
  if (induk === 'null') data = data.filter(x => !x.induk_iku);
  res.json(data);
});

router.get('/iku/:kode', (req, res) => {
  const item = db.get('mst_iku').find({ kode_iku: req.params.kode }).value();
  if (!item) return res.status(404).json({ error: 'IKU tidak ditemukan' });
  const bobot = db.get('mst_bobot').filter({ kode_iku: req.params.kode }).value();
  const sub = db.get('mst_iku').filter({ induk_iku: req.params.kode }).value();
  res.json({ ...item, bobot_kriteria: bobot, sub_indikator: sub });
});

router.put('/iku/:kode', roleAllowed('ADMIN'), (req, res) => {
  const updated = db.get('mst_iku').find({ kode_iku: req.params.kode }).assign(req.body).write();
  res.json(updated);
});

// ---- Bobot Kriteria ----
router.get('/bobot', (req, res) => {
  const { kode_iku } = req.query;
  let data = db.get('mst_bobot').value();
  if (kode_iku) data = data.filter(x => x.kode_iku === kode_iku);
  res.json(data);
});

// ---- Unit Kerja ----
router.get('/units', (req, res) => {
  res.json(db.get('units').value());
});

router.post('/units', roleAllowed('ADMIN'), (req, res) => {
  const { kode_unit, nama_unit, jenjang, unit_induk } = req.body || {};
  if (!kode_unit || !nama_unit) return res.status(400).json({ error: 'kode_unit dan nama_unit wajib diisi' });
  if (db.get('units').find({ kode_unit }).value()) return res.status(409).json({ error: 'Kode unit sudah ada' });
  const unit = { kode_unit, nama_unit, jenjang: jenjang || 'UNIT_KERJA', unit_induk: unit_induk || null };
  db.get('units').push(unit).write();
  res.status(201).json(unit);
});

// ---- Users (admin only) ----
router.get('/users', roleAllowed('ADMIN', 'LPM'), (req, res) => {
  const users = db.get('users').value().map(({ password, ...rest }) => rest);
  res.json(users);
});

module.exports = router;
