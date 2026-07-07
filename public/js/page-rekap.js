const PageRekap = (() => {
  async function render(container) {
    const tahun = new Date().getFullYear();
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <h3 style="margin:0;">Matriks Capaian Unit &times; IKU</h3>
          <div style="margin-left:auto;display:flex;gap:8px;">
            <select id="rTahun"><option value="${tahun}">${tahun}</option><option value="${tahun - 1}">${tahun - 1}</option></select>
            <select id="rTriwulan">
              <option value="TW1">TW1</option><option value="TW2">TW2</option><option value="TW3">TW3</option><option value="TW4" selected>TW4</option>
            </select>
          </div>
        </div>
        <p class="help-text">Warna sel menunjukkan persentase capaian terhadap target: hijau &ge;100%, kuning-hijau &ge;75%, kuning &ge;50%, merah &lt;50%. Sel abu menandakan belum ada laporan.</p>
        <div class="table-wrap" id="matriksWrap"></div>
      </div>
    `;
    document.getElementById('rTahun').addEventListener('change', load);
    document.getElementById('rTriwulan').addEventListener('change', load);
    await load();

    async function load() {
      const tahunVal = document.getElementById('rTahun').value;
      const twVal = document.getElementById('rTriwulan').value;
      const data = await API.getRekapMatriks(tahunVal, twVal);
      const wrap = document.getElementById('matriksWrap');
      if (!data.matriks.length) {
        wrap.innerHTML = '<div class="empty-state">Tidak ada unit dalam cakupan akses.</div>';
        return;
      }
      let html = '<table><thead><tr><th style="min-width:180px;">Unit Kerja</th>';
      data.iku_columns.forEach(c => { html += `<th class="cell-center" title="${c.nama}">${c.kode_iku}</th>`; });
      html += '</tr></thead><tbody>';
      data.matriks.forEach(row => {
        html += `<tr><td><b>${row.nama_unit}</b></td>`;
        data.iku_columns.forEach(c => {
          const v = row.nilai[c.kode_iku];
          if (!v) {
            html += `<td class="cell-center"><div class="heat-cell" style="background:#f1f1f1;color:#999;">-</div></td>`;
          } else {
            const pct = v.target ? (v.capaian / v.target) * 100 : (v.capaian >= 100 ? 100 : v.capaian);
            html += `<td class="cell-center"><div class="heat-cell" style="background:${Util.heatColor(pct)}" title="Status: ${v.status}">${Util.num(v.capaian, 1)}%</div></td>`;
          }
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;
    }
  }

  return { render };
})();
