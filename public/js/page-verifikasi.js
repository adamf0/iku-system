const PageVerifikasi = (() => {
  async function render(container) {
    const [antrean, tahunData] = await Promise.all([
      API.getAntrean(),
      API.getCapaianList({ status: 'DIVERIFIKASI' })
    ]);

    container.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <h3>Antrean Menunggu Verifikasi <span class="badge-count" style="margin-left:6px;">${antrean.length}</span></h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>IKU</th><th>Unit</th><th>Periode</th><th class="cell-num">Capaian</th><th>Aksi</th></tr></thead>
              <tbody id="tblAntrean"></tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <h3>Menunggu Pengesahan Final <span class="badge-count" style="margin-left:6px;background:#2e5395;">${tahunData.length}</span></h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>IKU</th><th>Unit</th><th>Periode</th><th class="cell-num">Capaian</th><th>Aksi</th></tr></thead>
              <tbody id="tblSahkan"></tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="modalArea"></div>
    `;

    const tblAntrean = document.getElementById('tblAntrean');
    if (!antrean.length) {
      tblAntrean.innerHTML = `<tr><td colspan="5"><div class="empty-state">Tidak ada data menunggu verifikasi.</div></td></tr>`;
    } else {
      antrean.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><b>${row.kode_iku}</b><br><span style="font-size:11px;color:#6b7280;">${row.nama_iku}</span></td>
          <td>${row.nama_unit}</td>
          <td>${row.triwulan} / ${row.tahun}</td>
          <td class="cell-num">${Util.num(row.nilai_capaian)}%</td>
          <td>
            <button class="btn btn-green btn-sm" data-id="${row.id_capaian}" data-act="approve">Setujui</button>
            <button class="btn btn-red btn-sm" data-id="${row.id_capaian}" data-act="reject">Tolak</button>
            <button class="btn btn-ghost btn-sm" data-id="${row.id_capaian}" data-act="detail">Detail</button>
          </td>
        `;
        tblAntrean.appendChild(tr);
      });
      tblAntrean.querySelectorAll('button[data-act="approve"]').forEach(b => b.addEventListener('click', () => doVerify(b.dataset.id, 'APPROVE')));
      tblAntrean.querySelectorAll('button[data-act="reject"]').forEach(b => b.addEventListener('click', () => doReject(b.dataset.id)));
      tblAntrean.querySelectorAll('button[data-act="detail"]').forEach(b => b.addEventListener('click', () => showDetail(b.dataset.id)));
    }

    const tblSahkan = document.getElementById('tblSahkan');
    if (!tahunData.length) {
      tblSahkan.innerHTML = `<tr><td colspan="5"><div class="empty-state">Tidak ada data menunggu pengesahan.</div></td></tr>`;
    } else {
      tahunData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><b>${row.kode_iku}</b><br><span style="font-size:11px;color:#6b7280;">${row.nama_iku}</span></td>
          <td>${row.nama_unit}</td>
          <td>${row.triwulan} / ${row.tahun}</td>
          <td class="cell-num">${Util.num(row.nilai_capaian)}%</td>
          <td><button class="btn btn-nav btn-sm" data-id="${row.id_capaian}" data-act="sahkan">Sahkan</button></td>
        `;
        tblSahkan.appendChild(tr);
      });
      tblSahkan.querySelectorAll('button[data-act="sahkan"]').forEach(b => b.addEventListener('click', () => doSahkan(b.dataset.id)));
    }

    async function doVerify(id, action) {
      try {
        const res = await API.verifyCapaian(id, action);
        Util.toast(res.message, 'success');
        render(container);
      } catch (err) { Util.toast(err.message, 'error'); }
    }

    function doReject(id) {
      const overlay = Util.el('div', { class: 'modal-overlay' });
      overlay.innerHTML = `
        <div class="modal-box">
          <h3>Tolak & Kembalikan Data</h3>
          <div class="form-group"><label>Alasan Penolakan</label><textarea id="rejReason" placeholder="Jelaskan kekurangan data/bukti dukung..."></textarea></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
            <button class="btn btn-ghost" id="rejCancel">Batal</button>
            <button class="btn btn-red" id="rejSubmit">Kirim Penolakan</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#rejCancel').onclick = () => overlay.remove();
      overlay.querySelector('#rejSubmit').onclick = async () => {
        try {
          const res = await API.verifyCapaian(id, 'REJECT', overlay.querySelector('#rejReason').value);
          Util.toast(res.message, 'success');
          overlay.remove();
          render(container);
        } catch (err) { Util.toast(err.message, 'error'); }
      };
    }

    async function doSahkan(id) {
      if (!confirm('Sahkan data ini sebagai capaian final periode berjalan?')) return;
      try {
        const res = await API.sahkanCapaian(id);
        Util.toast(res.message, 'success');
        render(container);
      } catch (err) { Util.toast(err.message, 'error'); }
    }

    async function showDetail(id) {
      const detail = await API.getCapaianDetail(id);
      const overlay = Util.el('div', { class: 'modal-overlay' });
      overlay.innerHTML = `
        <div class="modal-box">
          <h3>${detail.kode_iku} &middot; ${detail.kode_unit}</h3>
          <p style="font-size:13px;"><b>Periode:</b> ${detail.triwulan} / ${detail.tahun}</p>
          <p style="font-size:13px;"><b>Pembilang:</b> ${Util.num(detail.nilai_pembilang)} &nbsp; <b>Penyebut:</b> ${Util.num(detail.nilai_penyebut)}</p>
          <p style="font-size:13px;"><b>Capaian:</b> ${Util.num(detail.nilai_capaian)}% &nbsp; <b>Target:</b> ${Util.num(detail.target_capaian)}%</p>
          <p style="font-size:13px;"><b>Catatan:</b> ${detail.catatan || '-'}</p>
          <p style="font-size:13px;"><b>Diinput oleh:</b> ${detail.diinput_oleh} pada ${new Date(detail.tanggal_input).toLocaleString('id-ID')}</p>
          <p style="font-size:13px;"><b>Bukti Dukung:</b> ${detail.bukti.length ? detail.bukti.map(b => b.jenis_dokumen).join(', ') : 'Belum ada dokumen diunggah'}</p>
          <div style="display:flex;justify-content:flex-end;"><button class="btn btn-ghost" id="closeDetail">Tutup</button></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#closeDetail').onclick = () => overlay.remove();
    }
  }

  return { render };
})();
