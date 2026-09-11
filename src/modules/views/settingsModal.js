/**
 * Modal Impostazioni e Gestione Dati.
 */

import {
  getLastSyncTime,
  getCachedXmlHash,
  getTheme,
  setTheme
} from '../storage.js';

export function setupSettingsModal({
  modalOverlay,
  dataset,
  onSyncRequest,
  onResetCache
}) {
  const syncNowBtn = modalOverlay.querySelector('#modalSyncBtn');
  const clearCacheBtn = modalOverlay.querySelector('#modalClearCacheBtn');
  const themeToggleBtn = modalOverlay.querySelector('#modalThemeToggleBtn');
  const closeBtn = modalOverlay.querySelector('#modalCloseBtn');
  const statsContainer = modalOverlay.querySelector('#modalStatsContainer');

  function openModal() {
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
        <div style="background: rgba(20, 184, 166, 0.05); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; font-size: 0.8rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">school</span> Classi caricate: <strong style="color: var(--text-primary);">${dataset.classes.length}</strong></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">person</span> Docenti caricati: <strong style="color: var(--text-primary);">${dataset.teachers.length}</strong></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">menu_book</span> Materie registrate: <strong style="color: var(--text-primary);">${dataset.subjects.length}</strong></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">schedule</span> Fasce orarie: <strong style="color: var(--text-primary);">${dataset.timeSlots.length}</strong></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">inventory_2</span> Attività totali indicizzate: <strong style="color: var(--text-primary);">${dataset.totalActivities || 0}</strong></div>
          <div style="margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--border-subtle); font-size: 0.72rem; color: var(--text-muted);">
            Ultimo Sync: <strong>${lastSync ? lastSync.toLocaleString('it-IT') : 'Dataset locale iniziale'}</strong>
            <br>Versione Hash: <code>${hash || 'locale'}</code>
          </div>
        </div>
      `;
    }

    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = currentTheme === 'dark' 
        ? '<span style="display: inline-flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 18px;">light_mode</span> Attiva Tema Chiaro</span>' 
        : '<span style="display: inline-flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 18px;">dark_mode</span> Attiva Tema Scuro</span>';
    }
  }

  // Event Listeners
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

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
