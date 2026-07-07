const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../data/db');
const { SECRET, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi.' });

  const user = db.get('users').find({ username }).value();
  if (!user) return res.status(401).json({ error: 'Username atau password salah.' });

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Username atau password salah.' });

  const unit = db.get('units').find({ kode_unit: user.kode_unit }).value();

  const payload = { id: user.id, username: user.username, nama: user.nama, role: user.role, kode_unit: user.kode_unit };
  const token = jwt.sign(payload, SECRET, { expiresIn: '12h' });

  db.get('log_aktivitas').push({
    id: db.get('log_aktivitas').size().value() + 1,
    aksi: 'LOGIN', username, waktu: new Date().toISOString()
  }).write();

  res.json({
    token,
    user: { ...payload, nama_unit: unit ? unit.nama_unit : '-', jenjang_unit: unit ? unit.jenjang : '-' }
  });
});

router.get('/me', authRequired, (req, res) => {
  const unit = db.get('units').find({ kode_unit: req.user.kode_unit }).value();
  res.json({ ...req.user, nama_unit: unit ? unit.nama_unit : '-', jenjang_unit: unit ? unit.jenjang : '-' });
});

module.exports = router;
