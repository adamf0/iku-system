const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, '../data/db.json'));
const db = low(adapter);

// Struktur default database (lihat sheet 05_Skema_Data_Sistem pada workbook mapping IKU)
db.defaults({
  users: [],
  units: [],            // ref_satuan_kerja
  mst_iku: [],           // master indikator
  mst_bobot: [],         // mst_bobot_kriteria
  capaian: [],           // trx_capaian_iku
  rincian: [],           // trx_rincian_capaian
  bukti: [],             // trx_bukti_dukung
  log_aktivitas: []
}).write();

module.exports = db;
