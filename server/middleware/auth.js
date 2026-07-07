const jwt = require('jsonwebtoken');
const db = require('../data/db');

const SECRET = process.env.JWT_SECRET || 'unpak-iku-secret-key-2026';

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login kembali.' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa.' });
  }
}

function roleAllowed(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses untuk aksi ini.' });
    }
    next();
  };
}

// Mengembalikan daftar kode_unit yang boleh diakses/dilihat oleh user (cakupan hirarkis)
function scopeUnits(user) {
  const units = db.get('units').value();
  if (user.role === 'ADMIN' || user.role === 'LPM') {
    return units.map(u => u.kode_unit); // akses penuh seluruh unit
  }
  if (user.role === 'UNIT_KERJA') {
    return [user.kode_unit];
  }
  if (user.role === 'FAKULTAS') {
    // fakultas + seluruh prodi di bawahnya
    const anak = units.filter(u => u.unit_induk === user.kode_unit).map(u => u.kode_unit);
    return [user.kode_unit, ...anak];
  }
  if (user.role === 'PRODI') {
    return [user.kode_unit];
  }
  return [user.kode_unit];
}

module.exports = { authRequired, roleAllowed, scopeUnits, SECRET };
