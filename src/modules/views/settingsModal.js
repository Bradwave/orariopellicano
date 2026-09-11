/**
 * Modal Impostazioni e Gestione Dati.
 */

import {
  getLastSyncTime,
  getCachedXmlHash,
  getTheme,
  setTheme,
  getNextUpPreference,
  setNextUpPreference
} from '../storage.js';

export function setupSettingsModal({
  modalOverlay,
  dataset,
  onSyncRequest,
  onResetCache,
  onNextUpChange
}) {
  const syncNowBtn = modalOverlay.querySelector('#modalSyncBadgeBtn') || modalOverlay.querySelector('#modalSyncBtn');
  const syncIcon = modalOverlay.querySelector('#modalSyncIcon');
  const syncStatusTitle = modalOverlay.querySelector('#modalSyncStatusTitle');
  const syncStatusSub = modalOverlay.querySelector('#modalSyncStatusSub');
  const clearCacheBtn = modalOverlay.querySelector('#modalClearCacheBtn');
  const themeToggleBtn = modalOverlay.querySelector('#modalThemeToggleBtn');
  const nextUpToggle = modalOverlay.querySelector('#modalNextUpToggle');
  const closeBtn = modalOverlay.querySelector('#modalCloseBtn');
  const statsContainer = modalOverlay.querySelector('#modalStatsContainer');

  function openModal() {
    updateStats();
    modalOverlay.classList.add('open');
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
  }

  function setSyncStatus(status = 'online', title = null, sub = null) {
    const lastSync = getLastSyncTime();
    if (syncNowBtn) {
      syncNowBtn.className = 'sync-status-badge ' + status;
    }
    if (syncIcon) {
      syncIcon.className = 'material-symbols-outlined sync-icon ' + status;
      if (status === 'syncing') {
        syncIcon.textContent = 'sync';
      } else if (status === 'error') {
        syncIcon.textContent = 'sync_problem';
      } else if (status === 'offline') {
        syncIcon.textContent = 'cloud_off';
      } else {
        syncIcon.textContent = 'cloud_done';
      }
    }
    if (syncStatusTitle) {
      if (title) syncStatusTitle.textContent = title;
      else if (status === 'syncing') syncStatusTitle.textContent = 'Verifica in corso...';
      else if (status === 'error') syncStatusTitle.textContent = 'Errore sincronizzazione';
      else if (status === 'offline') syncStatusTitle.textContent = 'Dispositivo offline';
      else syncStatusTitle.textContent = 'Orario sincronizzato';
    }
    if (syncStatusSub) {
      if (sub) syncStatusSub.textContent = sub;
      else if (status === 'syncing') syncStatusSub.textContent = 'Connessione al server...';
      else {
        syncStatusSub.textContent = lastSync 
          ? `Ultimo sync: ${lastSync.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
          : 'Dataset locale iniziale';
      }
    }
  }

  function updateStats() {
    const lastSync = getLastSyncTime();
    const hash = getCachedXmlHash();
    const currentTheme = getTheme();

    if (!syncNowBtn || !syncNowBtn.classList.contains('syncing')) {
      setSyncStatus('online');
    }

    if (statsContainer && dataset) {
      statsContainer.innerHTML = `
        <div style="background: rgba(20, 184, 166, 0.05); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; font-size: 0.8rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">school</span> Classi caricate: <strong style="color: var(--text-primary);">${dataset.classes.length}</strong></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">person</span> Docenti caricati: <strong style="color: var(--text-primary);">${dataset.teachers.length}</strong></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">menu_book</span> Materie registrate: <strong style="color: var(--text-primary);">${dataset.subjects.length}</strong></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">schedule</span> Fasce orarie: <strong style="color: var(--text-primary);">${dataset.timeSlots.length}</strong></div>
          <div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px;">inventory_2</span> Attività totali indicizzate: <strong style="color: var(--text-primary);">${dataset.totalActivities || 0}</strong></div>
          <div style="margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--border-subtle); font-size: 0.72rem; color: var(--text-muted);">
            Ultimo sync: <strong>${lastSync ? lastSync.toLocaleString('it-IT') : 'Dataset locale iniziale'}</strong>
            <br>Versione hash: <code>${hash || 'locale'}</code>
          </div>
        </div>
      `;
    }

    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = currentTheme === 'dark' 
        ? '<span style="display: inline-flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 18px;">light_mode</span> Attiva tema chiaro</span>' 
        : '<span style="display: inline-flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 18px;">dark_mode</span> Attiva tema scuro</span>';
    }

    if (nextUpToggle) {
      nextUpToggle.checked = getNextUpPreference();
    }
  }

  // Event Listeners
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', () => {
      setSyncStatus('syncing', 'Verifica in corso...', 'Connessione al server...');
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

  if (nextUpToggle) {
    nextUpToggle.addEventListener('change', () => {
      setNextUpPreference(nextUpToggle.checked);
      if (onNextUpChange) onNextUpChange(nextUpToggle.checked);
    });
  }

  return {
    open: openModal,
    close: closeModal,
    updateStats,
    setSyncStatus
  };
}
