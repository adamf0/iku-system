const PageInput = (() => {
  const TRIWULAN = ['TW1', 'TW2', 'TW3', 'TW4'];
  let ikuList = [], unitList = [], user;

  async function render(container, currentUser) {
    user = currentUser;
    const tahun = new Date().getFullYear();
    [ikuList, unitList] = await Promise.all([API.getIkuList('?induk=null'), API.getUnits()]);

    const editableUnits = unitScopeForUser(user, unitList);

    container.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <h3>Form Input Capaian IKU Triwulanan</h3>
        <form id="formCapaian">
          <div class="form-row">
            <div class="form-group">
              <label>Unit Pelapor</label>
              <select id="fUnit" required>${editableUnits.map(u => `<option value="${u.kode_unit}">${u.nama_unit}</option>`).join('')}</select>
            </div>
            <div class="form-group">
              <label>Indikator Kinerja Utama (IKU)</label>
              <select id="fIku" required></select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Tahun</label>
              <input type="number" id="fTahun" value="${tahun}" min="2020" max="2100" required />
            </div>
            <div class="form-group">
              <label>Triwulan</label>
              <select id="fTriwulan" required>${TRIWULAN.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label id="labelPembilang">Nilai Pembilang</label>
              <input type="number" step="any" id="fPembilang" required />
            </div>
            <div class="form-group">
              <label id="labelPenyebut">Nilai Penyebut</label>
              <input type="number" step="any" id="fPenyebut" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Target Capaian (%)</label>
              <input type="number" step="any" id="fTarget" />
            </div>
            <div class="form-group">
              <label>Estimasi Capaian</label>
              <input type="text" id="fPreview" disabled style="background:#f4f5f7;font-weight:700;" />
            </div>
          </div>
          <div class="form-group">
            <label>Catatan / Penjelasan Data</label>
            <textarea id="fCatatan" placeholder="Contoh: rincian sumber data, metode penghitungan, dsb."></textarea>
          </div>
          <div id="formulaHint" class="help-text" style="margin-bottom:10px;"></div>
          <button class="btn btn-nav" type="submit">Simpan sebagai Draft</button>
        </form>
      </div>

      <div class="card">
        <div class="toolbar">
          <h3 style="margin:0;">Riwayat Laporan Unit Anda</h3>
          <div style="margin-left:auto;display:flex;gap:8px;">
            <select id="filterTahun"><option value="${tahun}">${tahun}</option><option value="${tahun - 1}">${tahun - 1}</option></select>
            <select id="filterTriwulan"><option value="">Semua Triwulan</option>${TRIWULAN.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>IKU</th><th>Unit</th><th>Periode</th><th class="cell-num">Capaian</th><th class="cell-num">Target</th>
              <th>Status</th><th>Aksi</th>
            </tr></thead>
            <tbody id="tblRiwayat"></tbody>
          </table>
        </div>
      </div>
    `;

    const fIku = document.getElementById('fIku');
    ikuList.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i.kode_iku;
      opt.textContent = `${i.kode_iku} - ${i.nama_indikator}`;
      fIku.appendChild(opt);
    });

    function updateFormulaHint() {
      const iku = ikuList.find(i => i.kode_iku === fIku.value);
      document.getElementById('formulaHint').innerHTML = iku
        ? `<b>Formula:</b> ${iku.formula_text} &nbsp;|&nbsp; <b>Satuan:</b> ${iku.satuan} &nbsp;|&nbsp; <b>Sumber data:</b> ${iku.sumber_data}`
        : '';
      const isRasio = iku ? iku.berbasis_rasio : true;
      document.getElementById('labelPembilang').textContent = isRasio ? 'Nilai Pembilang (Numerator)' : 'Nilai Realisasi';
      document.getElementById('labelPenyebut').textContent = isRasio ? 'Nilai Penyebut (Denominator)' : 'Nilai Basis / Total';
    }
    fIku.addEventListener('change', updateFormulaHint);
    updateFormulaHint();

    function updatePreview() {
      const p = Number(document.getElementById('fPembilang').value) || 0;
      const q = Number(document.getElementById('fPenyebut').value) || 0;
      const hasil = q === 0 ? 0 : (p / q * 100);
      document.getElementById('fPreview').value = hasil.toFixed(2) + ' %';
    }
    document.getElementById('fPembilang').addEventListener('input', updatePreview);
    document.getElementById('fPenyebut').addEventListener('input', updatePreview);

    document.getElementById('formCapaian').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        kode_iku: fIku.value,
        kode_unit: document.getElementById('fUnit').value,
        tahun: Number(document.getElementById('fTahun').value),
        triwulan: document.getElementById('fTriwulan').value,
        nilai_pembilang: Number(document.getElementById('fPembilang').value),
        nilai_penyebut: Number(document.getElementById('fPenyebut').value),
        target_capaian: Number(document.getElementById('fTarget').value) || 0,
        catatan: document.getElementById('fCatatan').value
      };
      try {
        const res = await API.saveCapaian(payload);
        Util.toast(res.message || 'Data tersimpan', 'success');
        e.target.reset();
        document.getElementById('fTahun').value = tahun;
        loadRiwayat();
      } catch (err) {
        Util.toast(err.message, 'error');
      }
    });

    document.getElementById('filterTahun').addEventListener('change', loadRiwayat);
    document.getElementById('filterTriwulan').addEventListener('change', loadRiwayat);

    await loadRiwayat();
  }

  function unitScopeForUser(user, units) {
    if (user.role === 'ADMIN') return units.filter(u => u.kode_unit !== 'UNPAK');
    if (user.role === 'FAKULTAS') return units.filter(u => u.kode_unit === user.kode_unit || u.unit_induk === user.kode_unit);
    return units.filter(u => u.kode_unit === user.kode_unit);
  }

  async function loadRiwayat() {
    const tahun = document.getElementById('filterTahun').value;
    const triwulan = document.getElementById('filterTriwulan').value;
    const params = { tahun };
    if (triwulan) params.triwulan = triwulan;
    const data = await API.getCapaianList(params);
    const tbody = document.getElementById('tblRiwayat');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Belum ada data laporan pada periode ini.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = '';
    data.forEach(row => {
      const tr = document.createElement('tr');
      const canEdit = ['DRAFT', 'DITOLAK'].includes(row.status_validasi);
      tr.innerHTML = `
        <td><b>${row.kode_iku}</b><br><span style="font-size:11px;color:#6b7280;">${row.nama_iku}</span></td>
        <td>${row.nama_unit}</td>
        <td>${row.triwulan} / ${row.tahun}</td>
        <td class="cell-num">${Util.num(row.nilai_capaian)}%</td>
        <td class="cell-num">${Util.num(row.target_capaian)}%</td>
        <td>${Util.statusTag(row.status_validasi)}${row.alasan_penolakan ? `<div style="font-size:11px;color:#b71c1c;margin-top:3px;">${row.alasan_penolakan}</div>` : ''}</td>
        <td>
          ${canEdit ? `<button class="btn btn-ghost btn-sm" data-act="submit" data-id="${row.id_capaian}">Ajukan</button>` : ''}
          ${row.status_validasi === 'DRAFT' ? `<button class="btn btn-red btn-sm" data-act="delete" data-id="${row.id_capaian}">Hapus</button>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('button[data-act="submit"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const res = await API.submitCapaian(btn.dataset.id);
          Util.toast(res.message, 'success');
          loadRiwayat();
        } catch (err) { Util.toast(err.message, 'error'); }
      });
    });
    tbody.querySelectorAll('button[data-act="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Hapus data draft ini?')) return;
        try {
          await API.deleteCapaian(btn.dataset.id);
          Util.toast('Data draft dihapus', 'success');
          loadRiwayat();
        } catch (err) { Util.toast(err.message, 'error'); }
      });
    });
  }

  return { render };
})();
