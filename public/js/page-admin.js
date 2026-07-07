const PageAdmin = (() => {
  async function render(container) {
    const [units, users] = await Promise.all([API.getUnits(), API.getUsers()]);

    container.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <h3>Struktur Unit Kerja</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Kode</th><th>Nama Unit</th><th>Jenjang</th><th>Induk</th></tr></thead>
              <tbody>
                ${units.map(u => `<tr><td><b>${u.kode_unit}</b></td><td>${u.nama_unit}</td><td>${u.jenjang}</td><td>${u.unit_induk || '-'}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <h3>Tambah Unit Kerja / Program Studi Baru</h3>
          <form id="formUnit">
            <div class="form-group"><label>Kode Unit (unik)</label><input type="text" id="uKode" required placeholder="Contoh: FH-IH" /></div>
            <div class="form-group"><label>Nama Unit</label><input type="text" id="uNama" required placeholder="Program Studi Ilmu Hukum" /></div>
            <div class="form-group"><label>Jenjang</label>
              <select id="uJenjang">
                <option value="FAKULTAS">Fakultas</option>
                <option value="LEMBAGA">Lembaga</option>
                <option value="UNIT_KERJA">Unit Kerja</option>
                <option value="D3">D3</option><option value="D4">D4</option>
                <option value="S1" selected>S1</option><option value="S2">S2</option><option value="S3">S3</option>
              </select>
            </div>
            <div class="form-group"><label>Unit Induk (opsional)</label>
              <select id="uInduk"><option value="">- Tidak ada -</option>${units.filter(u => ['FAKULTAS', 'INSTITUSI'].includes(u.jenjang)).map(u => `<option value="${u.kode_unit}">${u.nama_unit}</option>`).join('')}</select>
            </div>
            <button class="btn btn-nav" type="submit">Simpan Unit</button>
          </form>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <h3>Daftar Pengguna Sistem</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Unit</th><th>Email</th></tr></thead>
            <tbody>
              ${users.map(u => `<tr><td>${u.username}</td><td>${u.nama}</td><td><span class="chip tag-diverifikasi">${u.role}</span></td><td>${u.kode_unit}</td><td>${u.email}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="help-text" style="margin-top:10px;">Penambahan pengguna baru dilakukan melalui endpoint API <code>/api/master/users</code> (dapat dikembangkan lebih lanjut menjadi form UI sesuai kebutuhan tata kelola akun UNPAK, mis. integrasi dengan SSO/SIAKAD).</p>
      </div>
    `;

    document.getElementById('formUnit').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await API.createUnit({
          kode_unit: document.getElementById('uKode').value.trim(),
          nama_unit: document.getElementById('uNama').value.trim(),
          jenjang: document.getElementById('uJenjang').value,
          unit_induk: document.getElementById('uInduk').value || null
        });
        Util.toast('Unit kerja baru tersimpan', 'success');
        render(container);
      } catch (err) { Util.toast(err.message, 'error'); }
    });
  }

  return { render };
})();
