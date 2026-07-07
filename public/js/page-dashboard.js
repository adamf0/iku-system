const PageDashboard = (() => {
  let chartStatus, chartCapaian, chartTrend;

  async function render(container, user) {
    const tahun = new Date().getFullYear();
    const [summary, kelengkapan] = await Promise.all([
      API.getSummary(tahun),
      API.getKelengkapan(tahun)
    ]);

    const statusCount = summary.status_count;
    const totalLaporan = summary.total_laporan;

    container.innerHTML = `
      <div class="grid grid-4">
        <div class="card stat-card">
          <div class="label">Unit Terpantau</div>
          <div class="value">${summary.total_unit_terpantau}</div>
          <span class="tag tag-diverifikasi" style="align-self:flex-start;font-size:10.5px;padding:2px 8px;border-radius:10px;">dalam cakupan akses Anda</span>
        </div>
        <div class="card stat-card">
          <div class="label">IKU Dipantau</div>
          <div class="value">${summary.total_iku_dipantau}</div>
          <span class="tag tag-wajib" style="align-self:flex-start;font-size:10.5px;padding:2px 8px;border-radius:10px;">indikator utama</span>
        </div>
        <div class="card stat-card">
          <div class="label">Total Laporan Tahun ${tahun}</div>
          <div class="value">${totalLaporan}</div>
          <span class="tag tag-diajukan" style="align-self:flex-start;font-size:10.5px;padding:2px 8px;border-radius:10px;">${statusCount.DIAJUKAN} menunggu verifikasi</span>
        </div>
        <div class="card stat-card">
          <div class="label">Persentase IKU Tercapai</div>
          <div class="value">${summary.persentase_iku_tercapai}%</div>
          <span class="tag tag-disahkan" style="align-self:flex-start;font-size:10.5px;padding:2px 8px;border-radius:10px;">dari data yang sudah disahkan</span>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:16px;">
        <div class="card">
          <h3>Capaian Rata-rata vs Target per IKU (Data Disahkan Terkini)</h3>
          <canvas id="chartCapaian" height="110"></canvas>
        </div>
        <div class="card">
          <h3>Status Alur Pelaporan</h3>
          <canvas id="chartStatus" height="110"></canvas>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:16px;">
        <div class="card">
          <h3>Tren Capaian per Triwulan
            <select id="selectIkuTrend" style="float:right;font-size:12px;padding:4px 8px;border-radius:6px;border:1px solid #dfe3ea;"></select>
          </h3>
          <canvas id="chartTrend" height="120"></canvas>
        </div>
        <div class="card">
          <h3>Kelengkapan Pelaporan Triwulanan per Unit</h3>
          <div id="kelengkapanBox"></div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <h3>Ringkasan Capaian per IKU</h3>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Kode</th><th>Nama Indikator</th><th>Sifat</th><th>Triwulan Terakhir</th>
              <th class="cell-num">Capaian</th><th class="cell-num">Target</th><th>Status</th>
            </tr></thead>
            <tbody id="tblPerIku"></tbody>
          </table>
        </div>
      </div>
    `;

    // ---- Table per IKU ----
    const tbody = document.getElementById('tblPerIku');
    summary.per_iku.forEach(row => {
      const tr = document.createElement('tr');
      const statusChip = row.status === 'TERCAPAI'
        ? '<span class="chip tag-tercapai">Tercapai</span>'
        : row.status === 'BELUM TERCAPAI'
          ? '<span class="chip tag-belum">Belum Tercapai</span>'
          : '<span class="chip tag-draft">Belum Ada Data</span>';
      tr.innerHTML = `
        <td><b>${row.kode_iku}</b></td>
        <td>${row.nama_indikator}</td>
        <td>${Util.sifatTag(row.sifat)}</td>
        <td>${row.triwulan_terakhir || '-'}</td>
        <td class="cell-num">${row.capaian_rata !== null ? Util.num(row.capaian_rata) + '%' : '-'}</td>
        <td class="cell-num">${row.target !== null ? Util.num(row.target) + '%' : '-'}</td>
        <td>${statusChip}</td>
      `;
      tbody.appendChild(tr);
    });

    // ---- Chart: capaian vs target ----
    const withData = summary.per_iku.filter(x => x.capaian_rata !== null);
    const ctxCap = document.getElementById('chartCapaian').getContext('2d');
    if (chartCapaian) chartCapaian.destroy();
    chartCapaian = new Chart(ctxCap, {
      type: 'bar',
      data: {
        labels: (withData.length ? withData : summary.per_iku).map(x => x.kode_iku),
        datasets: [
          { label: 'Capaian (%)', data: (withData.length ? withData : summary.per_iku).map(x => x.capaian_rata || 0), backgroundColor: '#2e5395' },
          { label: 'Target (%)', data: (withData.length ? withData : summary.per_iku).map(x => x.target || 0), backgroundColor: '#bf8f00' }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
    });

    // ---- Chart: status pie ----
    const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: ['Draft', 'Diajukan', 'Diverifikasi', 'Disahkan', 'Ditolak'],
        datasets: [{
          data: [statusCount.DRAFT, statusCount.DIAJUKAN, statusCount.DIVERIFIKASI, statusCount.DISAHKAN, statusCount.DITOLAK],
          backgroundColor: ['#9e9e9e', '#bf8f00', '#2e5395', '#2e7d32', '#b71c1c']
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    // ---- Trend chart with selector ----
    const selectTrend = document.getElementById('selectIkuTrend');
    summary.per_iku.forEach(x => {
      const opt = document.createElement('option');
      opt.value = x.kode_iku; opt.textContent = `${x.kode_iku} - ${x.nama_indikator}`;
      selectTrend.appendChild(opt);
    });
    async function loadTrend(kode) {
      const trend = await API.getTrend(kode, tahun);
      const ctxTrend = document.getElementById('chartTrend').getContext('2d');
      if (chartTrend) chartTrend.destroy();
      chartTrend = new Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: trend.trend.map(t => t.triwulan),
          datasets: [
            { label: 'Capaian (%)', data: trend.trend.map(t => t.capaian), borderColor: '#2e5395', backgroundColor: '#2e5395', tension: .3, spanGaps: true },
            { label: 'Target (%)', data: trend.trend.map(t => t.target), borderColor: '#bf8f00', borderDash: [6, 4], backgroundColor: '#bf8f00', tension: .3, spanGaps: true }
          ]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
      });
    }
    if (summary.per_iku.length) { selectTrend.value = summary.per_iku[0].kode_iku; loadTrend(summary.per_iku[0].kode_iku); }
    selectTrend.addEventListener('change', (e) => loadTrend(e.target.value));

    // ---- Kelengkapan pelaporan ----
    const box = document.getElementById('kelengkapanBox');
    if (!kelengkapan.data.length) {
      box.innerHTML = '<div class="empty-state">Tidak ada unit dalam cakupan akses.</div>';
    } else {
      box.innerHTML = kelengkapan.data.map(u => `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px;">
            <b>${u.nama_unit}</b>
          </div>
          <div style="display:flex;gap:6px;">
            ${['TW1', 'TW2', 'TW3', 'TW4'].map(tw => `
              <div style="flex:1;">
                <div style="font-size:10.5px;color:#6b7280;text-align:center;">${tw}</div>
                <div class="progress-bar"><div class="fill" style="width:${u.per_triwulan[tw].persen}%;background:${u.per_triwulan[tw].persen >= 100 ? '#2e7d32' : u.per_triwulan[tw].persen > 0 ? '#bf8f00' : '#e0e0e0'}"></div></div>
                <div style="font-size:10px;text-align:center;color:#6b7280;">${u.per_triwulan[tw].terisi}/${u.per_triwulan[tw].total}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }
  }

  return { render };
})();
