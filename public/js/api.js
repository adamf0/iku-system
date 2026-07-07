const API = (() => {
  const BASE = '/api';

  function token() { return localStorage.getItem('iku_token'); }

  async function request(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token()) headers['Authorization'] = 'Bearer ' + token();
    const res = await fetch(BASE + path, { ...options, headers });
    let data;
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      const err = new Error(data.error || 'Terjadi kesalahan.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/auth/me'),

    getIkuList: (q = '') => request('/master/iku' + q),
    getIkuDetail: (kode) => request('/master/iku/' + encodeURIComponent(kode)),
    getBobot: (kode_iku) => request('/master/bobot' + (kode_iku ? '?kode_iku=' + encodeURIComponent(kode_iku) : '')),
    getUnits: () => request('/master/units'),
    createUnit: (payload) => request('/master/units', { method: 'POST', body: JSON.stringify(payload) }),
    getUsers: () => request('/master/users'),

    getCapaianList: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('/capaian' + (qs ? '?' + qs : ''));
    },
    getCapaianDetail: (id) => request('/capaian/' + id),
    saveCapaian: (payload) => request('/capaian', { method: 'POST', body: JSON.stringify(payload) }),
    submitCapaian: (id) => request(`/capaian/${id}/submit`, { method: 'POST' }),
    verifyCapaian: (id, action, catatan) => request(`/capaian/${id}/verify`, { method: 'POST', body: JSON.stringify({ action, catatan }) }),
    sahkanCapaian: (id) => request(`/capaian/${id}/sahkan`, { method: 'POST' }),
    deleteCapaian: (id) => request('/capaian/' + id, { method: 'DELETE' }),
    addRincian: (id, payload) => request(`/capaian/${id}/rincian`, { method: 'POST', body: JSON.stringify(payload) }),
    getRincian: (id) => request(`/capaian/${id}/rincian`),
    addBukti: (id, payload) => request(`/capaian/${id}/bukti`, { method: 'POST', body: JSON.stringify(payload) }),

    getSummary: (tahun) => request('/dashboard/summary?tahun=' + tahun),
    getTrend: (kode_iku, tahun) => request(`/dashboard/trend/${kode_iku}?tahun=${tahun}`),
    getRekapMatriks: (tahun, triwulan) => request(`/dashboard/rekap-matriks?tahun=${tahun}&triwulan=${triwulan}`),
    getAntrean: () => request('/dashboard/antrean-verifikasi'),
    getKelengkapan: (tahun) => request('/dashboard/kelengkapan?tahun=' + tahun)
  };
})();
