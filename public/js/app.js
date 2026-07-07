const App = (() => {
  const root = document.getElementById('app');

  const MENU = [
    { hash: '#/dashboard', label: 'Dashboard', icon: '📊', roles: ['ADMIN', 'LPM', 'FAKULTAS', 'PRODI', 'UNIT_KERJA'] },
    { hash: '#/input', label: 'Input Capaian IKU', icon: '📝', roles: ['ADMIN', 'FAKULTAS', 'PRODI', 'UNIT_KERJA'] },
    { hash: '#/verifikasi', label: 'Verifikasi & Pengesahan', icon: '✅', roles: ['ADMIN', 'LPM'] },
    { hash: '#/rekap', label: 'Rekap & Matriks Unit', icon: '🗂️', roles: ['ADMIN', 'LPM', 'FAKULTAS', 'PRODI', 'UNIT_KERJA'] },
    { hash: '#/master', label: 'Master Kriteria & Bobot', icon: '📚', roles: ['ADMIN', 'LPM', 'FAKULTAS', 'PRODI', 'UNIT_KERJA'] },
    { hash: '#/admin', label: 'Administrasi Sistem', icon: '⚙️', roles: ['ADMIN'] }
  ];

  const ROLE_LABEL = {
    ADMIN: 'Administrator', LPM: 'Lembaga Penjaminan Mutu', FAKULTAS: 'Fakultas',
    PRODI: 'Program Studi', UNIT_KERJA: 'Unit Kerja / Lembaga'
  };

  function getUser() {
    try { return JSON.parse(localStorage.getItem('iku_user')); } catch (e) { return null; }
  }

  function logout() {
    localStorage.removeItem('iku_token');
    localStorage.removeItem('iku_user');
    window.location.hash = '#/login';
    boot();
  }

  function renderShell(user) {
    root.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand">
            <div class="logo">SIM-IKU UNPAK</div>
            <div class="sub">Diktisaintek Berdampak</div>
          </div>
          <nav id="sideNav"></nav>
          <div class="user-box">
            <div class="name">${user.nama}</div>
            <div>${user.nama_unit}</div>
            <span class="role-badge">${ROLE_LABEL[user.role] || user.role}</span>
            <button class="logout-btn" id="btnLogout">Keluar</button>
          </div>
        </aside>
        <div class="main">
          <div class="topbar">
            <div>
              <h2 id="pageTitle">Dashboard</h2>
              <div class="desc" id="pageDesc"></div>
            </div>
            <div style="font-size:12px;color:#6b7280;">Tahun Pelaporan <b id="tahunAktif">${new Date().getFullYear()}</b></div>
          </div>
          <div class="content" id="pageContent"></div>
        </div>
      </div>
    `;

    const nav = document.getElementById('sideNav');
    MENU.filter(m => m.roles.includes(user.role)).forEach(m => {
      const a = document.createElement('a');
      a.href = m.hash;
      a.innerHTML = `<span>${m.icon}</span><span>${m.label}</span>`;
      a.dataset.hash = m.hash;
      nav.appendChild(a);
    });
    document.getElementById('btnLogout').addEventListener('click', logout);
  }

  function setActiveMenu(hash) {
    document.querySelectorAll('#sideNav a').forEach(a => {
      a.classList.toggle('active', a.dataset.hash === hash.split('?')[0]);
    });
  }

  const ROUTES = {
    '#/dashboard': { title: 'Dashboard', desc: 'Ringkasan capaian IKU & status pelaporan', render: PageDashboard.render },
    '#/input': { title: 'Input Capaian IKU', desc: 'Entri data realisasi per triwulan', render: PageInput.render },
    '#/verifikasi': { title: 'Verifikasi & Pengesahan', desc: 'Antrean verifikasi oleh LPM', render: PageVerifikasi.render },
    '#/rekap': { title: 'Rekap & Matriks Unit', desc: 'Matriks capaian seluruh unit per triwulan', render: PageRekap.render },
    '#/master': { title: 'Master Kriteria & Bobot', desc: 'Referensi definisi, kriteria, bobot, dan formula IKU', render: PageMaster.render },
    '#/admin': { title: 'Administrasi Sistem', desc: 'Manajemen unit kerja & pengguna', render: PageAdmin.render }
  };

  async function router() {
    const user = getUser();
    let hash = window.location.hash || '#/dashboard';

    if (!user) {
      if (hash !== '#/login') window.location.hash = '#/login';
      PageLogin.render(root);
      return;
    }
    if (hash === '#/login') hash = '#/dashboard';

    const baseHash = hash.split('?')[0];
    const route = ROUTES[baseHash];
    if (!route) { window.location.hash = '#/dashboard'; return; }

    if (!document.querySelector('.app-shell')) renderShell(user);
    setActiveMenu(baseHash);
    document.getElementById('pageTitle').textContent = route.title;
    document.getElementById('pageDesc').textContent = route.desc;
    const container = document.getElementById('pageContent');
    container.innerHTML = '<div class="empty-state">Memuat data...</div>';
    try {
      await route.render(container, user);
    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="card"><p style="color:#b71c1c">Gagal memuat halaman: ${err.message}</p></div>`;
      if (err.status === 401) logout();
    }
  }

  function boot() {
    window.removeEventListener('hashchange', router);
    window.addEventListener('hashchange', router);
    router();
  }

  return { boot, getUser };
})();

App.boot();
