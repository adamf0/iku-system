const PageMaster = (() => {
  async function render(container) {
    const ikuList = await API.getIkuList('?induk=null');
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <h3 style="margin:0;">Referensi Definisi, Kriteria, Bobot & Formula IKU</h3>
          <select id="mIku" style="margin-left:auto;">
            ${ikuList.map(i => `<option value="${i.kode_iku}">${i.kode_iku} - ${i.nama_indikator}</option>`).join('')}
          </select>
        </div>
        <div id="ikuDetailBox"></div>
      </div>
    `;
    const select = document.getElementById('mIku');
    select.addEventListener('change', () => loadDetail(select.value));
    await loadDetail(select.value);

    async function loadDetail(kode) {
      const d = await API.getIkuDetail(kode);
      const box = document.getElementById('ikuDetailBox');
      box.innerHTML = `
        <div style="margin:14px 0;">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <h3 style="margin:0;">${d.kode_iku} &middot; ${d.nama_indikator}</h3>
            ${Util.sifatTag(d.sifat)}
          </div>
          <p style="font-size:13px;color:#374151;"><b>Sasaran Strategis:</b> ${d.sasaran_strategis} &nbsp;|&nbsp; <b>Satuan:</b> ${d.satuan} &nbsp;|&nbsp; <b>Arah Penilaian:</b> ${d.arah_penilaian === 'MAKIN_TINGGI_MAKIN_BAIK' ? 'Semakin tinggi semakin baik' : 'Semakin rendah semakin baik'}</p>
          <div class="card" style="background:#f8fafc;">
            <b style="font-size:12.5px;color:#1f3864;">Formula:</b>
            <p style="font-size:13px;margin:6px 0;">${d.formula_text}</p>
            <b style="font-size:12.5px;color:#1f3864;">Variabel Kunci:</b>
            <p style="font-size:13px;margin:6px 0;white-space:pre-line;">${d.variabel_kunci}</p>
            <b style="font-size:12.5px;color:#1f3864;">Sumber Data:</b>
            <p style="font-size:13px;margin:6px 0;">${d.sumber_data}</p>
          </div>

          ${d.bobot_kriteria.length ? `
          <h4 style="color:#1f3864;">Mapping Kriteria & Pembobotan</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Komponen</th><th>Kriteria / Kondisi</th><th class="cell-center">Bobot</th><th>Keterangan</th></tr></thead>
              <tbody>
                ${d.bobot_kriteria.map(b => `
                  <tr><td>${b.komponen}</td><td>${b.kondisi}</td><td class="cell-center"><b>${b.nilai_bobot}</b></td><td style="font-size:12px;color:#6b7280;">${b.keterangan || '-'}</td></tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : '<p class="help-text">Indikator ini tidak memiliki pembobotan numerik (dinilai berbasis kriteria kualitatif/checklist bukti dukung).</p>'}

          ${d.sub_indikator.length ? `
          <h4 style="color:#1f3864;">Sub-Indikator Terkait</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Kode</th><th>Nama</th><th>Formula</th></tr></thead>
              <tbody>
                ${d.sub_indikator.map(s => `<tr><td>${s.kode_iku}</td><td>${s.nama_indikator}</td><td style="font-size:12px;">${s.formula_text}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>` : ''}
        </div>
      `;
    }
  }

  return { render };
})();
