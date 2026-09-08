/**
 * Modal Impostazioni e configurazione Proxy Cloudflare Worker.
 */

import {
  getProxyUrl,
  setProxyUrl,
  getLastSyncTime,
  getCachedXmlHash,
  getTheme,
  setTheme,
  DEFAULT_PROXY_URL
} from '../storage.js';

export function setupSettingsModal({
  modalOverlay,
  dataset,
  onSyncRequest,
  onResetCache
}) {
  const proxyInput = modalOverlay.querySelector('#proxyUrlInput');
  const saveBtn = modalOverlay.querySelector('#saveProxyBtn');
  const resetProxyBtn = modalOverlay.querySelector('#resetProxyBtn');
  const syncNowBtn = modalOverlay.querySelector('#modalSyncBtn');
  const clearCacheBtn = modalOverlay.querySelector('#modalClearCacheBtn');
  const themeToggleBtn = modalOverlay.querySelector('#modalThemeToggleBtn');
  const closeBtn = modalOverlay.querySelector('#modalCloseBtn');
  const statsContainer = modalOverlay.querySelector('#modalStatsContainer');

  function openModal() {
    proxyInput.value = getProxyUrl();
    updateStats();
    modalOverlay.classList.add('open');
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
  }

  function updateStats() {
    const lastSync = getLastSyncTime();
    const hash = getCachedXmlHash();
    const currentTheme = getTheme();

    if (statsContainer && dataset) {
      statsContainer.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.04); border-radius: var(--radius-md); padding: 12px; font-size: 0.82rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
          <div>🏫 Classi caricate: <strong style="color: var(--text-primary);">${dataset.classes.length}</strong></div>
          <div>👨‍🏫 Docenti caricati: <strong style="color: var(--text-primary);">${dataset.teachers.length}</strong></div>
          <div>📚 Materie registrate: <strong style="color: var(--text-primary);">${dataset.subjects.length}</strong></div>
          <div>⏱️ Fasce orarie: <strong style="color: var(--text-primary);">${dataset.timeSlots.length}</strong></div>
          <div>📦 Attività totali indicizzate: <strong style="color: var(--text-primary);">${dataset.totalActivities || 0}</strong></div>
          <div style="margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--border-subtle); font-size: 0.75rem; color: var(--text-muted);">
            Ultimo Sync: <strong>${lastSync ? lastSync.toLocaleString('it-IT') : 'Dataset locale iniziale'}</strong>
            <br>Versione Hash: <code>${hash || 'locale'}</code>
          </div>
        </div>
      `;
    }

    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = currentTheme === 'dark' 
        ? '<span>☀️ Attiva Tema Chiaro</span>' 
        : '<span>🌙 Attiva Tema Scuro</span>';
    }
  }

  // Event Listeners
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const newUrl = proxyInput.value.trim();
      setProxyUrl(newUrl);
      alert('URL Proxy salvato con successo!');
      closeModal();
      if (onSyncRequest) onSyncRequest();
    });
  }

  if (resetProxyBtn) {
    resetProxyBtn.addEventListener('click', () => {
      proxyInput.value = DEFAULT_PROXY_URL;
      setProxyUrl('');
      alert('URL Proxy reimpostato al valore predefinito.');
    });
  }

  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', () => {
      closeModal();
      if (onSyncRequest) onSyncRequest();
    });
  }

  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
      if (confirm('Sei sicuro di voler cancellare la cache locale? L\'app ricaricherà i dati iniziali.')) {
        if (onResetCache) onResetCache();
        closeModal();
      }
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = getTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
      updateStats();
    });
  }

  return {
    open: openModal,
    close: closeModal,
    updateStats
  };
}
