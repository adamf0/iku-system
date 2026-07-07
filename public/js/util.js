const Util = (() => {
  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function statusTag(status) {
    const map = {
      DRAFT: ['tag-draft', 'Draft'],
      DIAJUKAN: ['tag-diajukan', 'Diajukan'],
      DIVERIFIKASI: ['tag-diverifikasi', 'Diverifikasi'],
      DISAHKAN: ['tag-disahkan', 'Disahkan'],
      DITOLAK: ['tag-ditolak', 'Ditolak']
    };
    const [cls, label] = map[status] || ['tag-draft', status];
    return `<span class="chip ${cls}">${label}</span>`;
  }

  function sifatTag(sifat) {
    const isWajib = String(sifat).includes('WAJIB');
    return `<span class="chip ${isWajib ? 'tag-wajib' : 'tag-pilihan'}">${sifat}</span>`;
  }

  function num(n, digits = 2) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function heatColor(pct) {
    if (pct === null || pct === undefined) return '#f1f1f1';
    if (pct >= 100) return '#c6e6c6';
    if (pct >= 75) return '#e6f2c6';
    if (pct >= 50) return '#ffe9b3';
    return '#f6c6c6';
  }

  return { toast, statusTag, sifatTag, num, el, heatColor };
})();
