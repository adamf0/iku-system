const PageLogin = (() => {
  const demoAccounts = [
    { role: 'Administrator', username: 'admin', password: 'admin123' },
    { role: 'LPM', username: 'lpm', password: 'lpm123' },
    { role: 'Fakultas Teknik', username: 'fakultas_ft', password: 'fakultas123' },
    { role: 'Prodi Teknik Informatika', username: 'prodi_ti', password: 'prodi123' },
    { role: 'Unit Kerja (LPPM)', username: 'unit_lppm', password: 'unit123' }
  ];

  function render(root) {
    root.innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <h1>Sistem Pelaporan IKU Diktisaintek Berdampak</h1>
          <p class="subtitle">Universitas Pakuan &middot; Pelaporan Triwulanan (TW1&ndash;TW4)</p>
          <form id="loginForm">
            <label>Username</label>
            <input type="text" id="loginUsername" autocomplete="username" required />
            <label>Password</label>
            <input type="password" id="loginPassword" autocomplete="current-password" required />
            <button class="btn-primary" type="submit">Masuk</button>
          </form>
          <div id="loginErrorBox"></div>
          <div class="demo-accounts">
            <b>Akun Demo (klik untuk isi otomatis):</b>
            <div id="demoList"></div>
          </div>
        </div>
      </div>
    `;

    const demoList = document.getElementById('demoList');
    demoAccounts.forEach(acc => {
      const row = document.createElement('div');
      row.className = 'demo-row';
      row.innerHTML = `<span>${acc.role}</span><span>${acc.username}</span>`;
      row.onclick = () => {
        document.getElementById('loginUsername').value = acc.username;
        document.getElementById('loginPassword').value = acc.password;
      };
      demoList.appendChild(row);
    });

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const errBox = document.getElementById('loginErrorBox');
      errBox.innerHTML = '';
      try {
        const data = await API.login(username, password);
        localStorage.setItem('iku_token', data.token);
        localStorage.setItem('iku_user', JSON.stringify(data.user));
        window.location.hash = '#/dashboard';
        App.boot();
      } catch (err) {
        errBox.innerHTML = `<div class="login-error">${err.message}</div>`;
      }
    });
  }

  return { render };
})();
