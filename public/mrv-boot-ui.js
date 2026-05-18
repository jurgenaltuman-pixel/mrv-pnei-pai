/**
 * Arranque antes del bundle Vite: actualiza barra de progreso (CSP sin inline).
 * Expone window.__MRV_SET_BOOT_PROGRESS(0–100, textoOpcional).
 */
(function () {
  function setBootProgress(pct, label) {
    var bar = document.getElementById('mrv-boot-bar-fill');
    if (bar) {
      var n = Math.max(0, Math.min(100, Number(pct) || 0));
      bar.style.width = n + '%';
      var host = document.getElementById('mrv-boot-bar');
      if (host) host.setAttribute('aria-valuenow', String(Math.round(n)));
    }
    if (typeof label === 'string' && label) {
      var st = document.getElementById('mrv-boot-status');
      if (st) st.textContent = label;
    }
  }
  window.__MRV_SET_BOOT_PROGRESS = setBootProgress;
})();
