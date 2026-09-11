/**
 * Entry point principale dell'applicazione Orario Pellicano SPA.
 * Gestione dello stato dell'app, router con deep-linking, PWA, Radar Colleghi
 * e gestione intelligente degli aggiornamenti con snackbar "Applica modifiche".
 */

import { parseEDTXml } from './modules/parser.js';
import {
  getCachedXml,
  saveXmlCache,
  getDefaultView,
  setDefaultView,
  clearDefaultView,
  getFavorites,
  toggleFavorite,
  isFavorite,
  getTheme,
  setTheme
} from './modules/storage.js';
import { fetchScheduleXml, checkBackgroundUpdate } from './modules/api.js';
import { startTimeWatcher } from './modules/time.js';

import { setupUnifiedSearch } from './modules/views/search.js';
import { renderClassView } from './modules/views/classView.js';
import { renderTeacherView } from './modules/views/teacherView.js';
import { renderSubjectView } from './modules/views/subjectView.js';
import { renderSubsDashboard } from './modules/views/subsView.js';
import { renderRadarView } from './modules/views/radarView.js';
import { setupSettingsModal } from './modules/views/settingsModal.js';

// Stato reattivo dell'applicazione
const state = {
  dataset: null,
  activeView: 'class', // 'class' | 'teacher' | 'subject' | 'subs' | 'radar' | 'favorites'
  activeId: null,
  activeDay: null,
  viewMode: 'list',    // 'list' | 'weekly'
  subsDay: null,
  subsSlot: 1,
  radarTeacherId: null,
  pendingUpdate: null
};

// Elementi DOM principali
const DOM = {
  mainContainer: document.getElementById('mainContent'),
  searchContainer: document.getElementById('searchContainer'),
  quickPillsBar: document.getElementById('quickPillsBar'),
  bottomNav: document.getElementById('bottomNav'),
  syncStatusBadge: document.getElementById('syncStatusBadge'),
  syncStatusText: document.getElementById('syncStatusText'),
  syncDot: document.getElementById('syncDot'),
  toastContainer: document.getElementById('toastContainer'),
  settingsModalOverlay: document.getElementById('settingsModalOverlay'),
  settingsBtn: document.getElementById('settingsBtn')
};

let searchComponent = null;
let settingsModal = null;

/**
 * Registrazione del Service Worker PWA per supporto offline completo.
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('🚀 [PWA] Service Worker registrato con successo:', reg.scope);
        })
        .catch((err) => {
          console.warn('⚠️ [PWA] Registrazione Service Worker fallita:', err);
        });
    });
  }
}

/**
 * Mostra una notifica toast discreta e animata.
 */
export function showToast(message, type = 'info', duration = 3500) {
  if (!DOM.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span class="material-symbols-outlined" style="font-size: 20px; color: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : 'var(--accent-primary)'};">
        ${type === 'success' ? 'check_circle' : type === 'warning' ? 'warning' : 'info'}
      </span>
      <span style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">${message}</span>
    </div>
    <button style="color: var(--text-muted); font-size: 16px; padding: 2px;">
      <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
    </button>
  `;

  toast.querySelector('button').addEventListener('click', () => toast.remove());
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Mostra la snackbar persistente di notifica aggiornamento segreteria con "Applica modifiche".
 */
function showUpdateSnackbar({ newXml, newHash }) {
  state.pendingUpdate = { newXml, newHash };

  // Evita duplicati se già visibile
  if (document.getElementById('updateSnackbar')) return;

  const snackbar = document.createElement('div');
  snackbar.className = 'update-snackbar';
  snackbar.id = 'updateSnackbar';
  snackbar.innerHTML = `
    <div class="snackbar-text-content">
      <span class="material-symbols-outlined" style="font-size: 24px; color: #a5b4fc;">campaign</span>
      <div>
        <div class="snackbar-title">L'orario è stato aggiornato dalla segreteria</div>
        <div class="snackbar-sub">Nuova versione oraria disponibile per la consultazione</div>
      </div>
    </div>
    <button class="snackbar-apply-btn" id="applyUpdateBtn">
      Applica modifiche
    </button>
  `;

  document.body.appendChild(snackbar);

  snackbar.querySelector('#applyUpdateBtn').addEventListener('click', () => {
    applyPendingUpdate();
  });
}

/**
 * Applica le modifiche dell'orario aggiornato e ri-renderizza il DOM.
 */
function applyPendingUpdate() {
  if (!state.pendingUpdate) return;
  const { newXml, newHash } = state.pendingUpdate;

  try {
    saveXmlCache(newXml, newHash);
    state.dataset = parseEDTXml(newXml);
    updateSyncStatus('online', 'Orario aggiornato');

    const snackbar = document.getElementById('updateSnackbar');
    if (snackbar) snackbar.remove();
    state.pendingUpdate = null;

    showToast('Nuovo orario applicato con successo!', 'success');
    renderCurrentView();
    renderQuickPills();
    if (settingsModal) settingsModal.updateStats();
  } catch (err) {
    console.error('Errore applicazione nuovo orario:', err);
    showToast('Errore durante l\'aggiornamento dell\'orario', 'warning');
  }
}

/**
 * Aggiorna il badge dello stato di sincronizzazione nell'header.
 */
function updateSyncStatus(status, text) {
  if (!DOM.syncStatusBadge) return;
  DOM.syncStatusText.textContent = text;
  DOM.syncDot.className = 'sync-dot';
  DOM.syncStatusBadge.className = 'sync-status-badge';

  if (status === 'syncing') {
    DOM.syncDot.classList.add('syncing');
    DOM.syncStatusBadge.classList.add('syncing');
  } else if (status === 'error') {
    DOM.syncDot.classList.add('error');
    DOM.syncStatusBadge.classList.add('error');
  } else if (status === 'offline') {
    DOM.syncDot.classList.add('offline');
    DOM.syncStatusBadge.classList.add('offline');
  } else if (status === 'online') {
    DOM.syncDot.classList.add('online');
    DOM.syncStatusBadge.classList.add('online');
  }
}

/**
 * Renderizza i Quick Pills (classi rapide o preferiti) sotto la search bar.
 */
function renderQuickPills() {
  if (!DOM.quickPillsBar || !state.dataset) return;
  const favs = getFavorites();

  let pillsData = [];
  if (favs.length > 0) {
    pillsData = favs.map(f => ({
      type: f.type,
      id: f.id,
      label: `<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: -2px; margin-right: 2px;">star</span>${f.id}`,
      active: state.activeView === f.type && state.activeId === f.id
    }));
  } else {
    // Prime 8 classi più frequenti come scorciatoie
    pillsData = state.dataset.classes.slice(0, 8).map(c => ({
      type: 'class',
      id: c.short,
      label: c.short,
      active: state.activeView === 'class' && state.activeId === c.short
    }));
  }

  DOM.quickPillsBar.innerHTML = pillsData.map(p => `
    <button class="quick-pill ${p.active ? 'active' : ''}" data-type="${p.type}" data-id="${p.id}">
      ${p.label}
    </button>
  `).join('');

  DOM.quickPillsBar.querySelectorAll('.quick-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      const id = btn.getAttribute('data-id');
      navigateTo(type, id);
    });
  });
}

/**
 * Naviga verso una vista e aggiorna il rendering.
 */
export function navigateTo(viewType, id = null, day = null) {
  state.activeView = viewType;
  if (id) state.activeId = id;
  if (day) state.activeDay = day;

  // Gestione defaults
  if (viewType === 'class' && !state.activeId && state.dataset.classes.length > 0) {
    state.activeId = state.dataset.classes[0].short;
  } else if (viewType === 'teacher' && !state.activeId && state.dataset.teachers.length > 0) {
    state.activeId = state.dataset.teachers[0].id;
  } else if (viewType === 'subject' && !state.activeId && state.dataset.subjects.length > 0) {
    state.activeId = state.dataset.subjects[0].code;
  } else if (viewType === 'radar' && id) {
    state.radarTeacherId = id;
  }

  updateBottomNavHighlight();
  renderQuickPills();
  renderCurrentView();
}

/**
 * Aggiorna l'icona attiva nella bottom navigation bar.
 */
function updateBottomNavHighlight() {
  if (!DOM.bottomNav) return;
  DOM.bottomNav.querySelectorAll('.nav-item-btn').forEach(btn => {
    const target = btn.getAttribute('data-nav');
    if (target === state.activeView) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Renderizza la vista attualmente selezionata.
 */
function renderCurrentView() {
  if (!state.dataset || !DOM.mainContainer) return;

  const defaultPref = getDefaultView();
  const isDefaultClass = defaultPref && defaultPref.type === 'class' && defaultPref.id === state.activeId;
  const isDefaultTeacher = defaultPref && defaultPref.type === 'teacher' && defaultPref.id === state.activeId;

  switch (state.activeView) {
    case 'class':
      renderClassView({
        container: DOM.mainContainer,
        dataset: state.dataset,
        className: state.activeId,
        activeDay: state.activeDay,
        viewMode: state.viewMode,
        isFavorite: isFavorite('class', state.activeId),
        isDefault: isDefaultClass,
        onDayChange: (day) => {
          state.activeDay = day;
          renderCurrentView();
        },
        onViewModeChange: (mode) => {
          state.viewMode = mode;
          renderCurrentView();
        },
        onTeacherClick: (teacherId) => navigateTo('teacher', teacherId),
        onToggleFavorite: (type, id, title) => {
          const res = toggleFavorite(type, id, title);
          showToast(res.added ? `Aggiunto ai preferiti: ${id}` : `Rimosso dai preferiti: ${id}`, 'info');
          renderQuickPills();
          renderCurrentView();
        },
        onSetDefault: (type, id, title) => {
          if (isDefaultClass) {
            clearDefaultView();
            showToast(`Rimossa vista predefinita`, 'info');
          } else {
            setDefaultView(type, id, title);
            showToast(`Impostata come vista predefinita all'avvio: ${id}`, 'success');
          }
          renderCurrentView();
        },
        onShowToast: showToast
      });
      break;

    case 'teacher':
      renderTeacherView({
        container: DOM.mainContainer,
        dataset: state.dataset,
        teacherId: state.activeId,
        activeDay: state.activeDay,
        viewMode: state.viewMode,
        isFavorite: isFavorite('teacher', state.activeId),
        isDefault: isDefaultTeacher,
        onDayChange: (day) => {
          state.activeDay = day;
          renderCurrentView();
        },
        onViewModeChange: (mode) => {
          state.viewMode = mode;
          renderCurrentView();
        },
        onClassClick: (className) => navigateTo('class', className),
        onRadarClick: (teacherId) => {
          state.radarTeacherId = teacherId;
          navigateTo('radar');
        },
        onToggleFavorite: (type, id, title) => {
          const res = toggleFavorite(type, id, title);
          showToast(res.added ? `Aggiunto ai preferiti: ${id}` : `Rimosso dai preferiti: ${id}`, 'info');
          renderQuickPills();
          renderCurrentView();
        },
        onSetDefault: (type, id, title) => {
          if (isDefaultTeacher) {
            clearDefaultView();
            showToast(`Rimossa vista predefinita`, 'info');
          } else {
            setDefaultView(type, id, title);
            showToast(`Impostata come vista predefinita all'avvio: ${id}`, 'success');
          }
          renderCurrentView();
        },
        onShowToast: showToast
      });
      break;

    case 'subject':
      renderSubjectView({
        container: DOM.mainContainer,
        dataset: state.dataset,
        subjectCode: state.activeId,
        onClassClick: (className) => navigateTo('class', className),
        onTeacherClick: (teacherId) => navigateTo('teacher', teacherId)
      });
      break;

    case 'subs':
      renderSubsDashboard({
        container: DOM.mainContainer,
        dataset: state.dataset,
        selectedDay: state.subsDay,
        selectedSlotIndex: state.subsSlot,
        onDayChange: (day) => {
          state.subsDay = day;
          renderCurrentView();
        },
        onSlotChange: (slotIdx) => {
          state.subsSlot = slotIdx;
          renderCurrentView();
        },
        onTeacherClick: (teacherId) => navigateTo('teacher', teacherId)
      });
      break;

    case 'radar':
      renderRadarView({
        container: DOM.mainContainer,
        dataset: state.dataset,
        selectedTeacherId: state.radarTeacherId,
        onTeacherSelect: (teacherId) => {
          state.radarTeacherId = teacherId;
          renderCurrentView();
        },
        onViewFullSchedule: (teacherId) => navigateTo('teacher', teacherId),
        onShowToast: showToast
      });
      break;

    case 'favorites':
      renderFavoritesView();
      break;

    default:
      navigateTo('class');
  }
}

/**
 * Vista dedicata per consultare tutti i preferiti salvati dall'utente.
 */
function renderFavoritesView() {
  const favs = getFavorites();
  const defaultPref = getDefaultView();

  DOM.mainContainer.innerHTML = `
    <div class="active-view-banner">
      <div class="banner-entity-info">
        <span class="banner-type-badge">Segnalibri</span>
        <h1 class="banner-entity-name">I Tuoi Preferiti</h1>
        <span style="font-size: 0.8rem; color: var(--text-muted);">
          Accesso rapido a classi e docenti salvati
        </span>
      </div>
    </div>

    <div class="schedule-list">
      ${defaultPref ? `
        <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid var(--border-focus); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 8px;">
          <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--accent-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined" style="font-size: 15px;">home</span>
            Vista Predefinita all'Avvio
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <strong>${defaultPref.title || defaultPref.id}</strong>
            <button id="clearDefPrefBtn" class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;">
              Rimuovi Predefinito
            </button>
          </div>
        </div>
      ` : ''}

      ${favs.length === 0 ? `
        <div class="state-container">
          <div class="state-icon"><span class="material-symbols-outlined" style="font-size: 32px; color: var(--accent-primary);">star_outline</span></div>
          <div class="state-title">Nessun preferito salvato</div>
          <div class="state-desc">Usa il pulsante "Salva" o la stellina quando consulti una classe o un docente per aggiungerli qui.</div>
        </div>
      ` : favs.map(f => `
        <div class="hour-card" style="flex-direction: row; align-items: center; justify-content: space-between; cursor: pointer;" data-fav-type="${f.type}" data-fav-id="${f.id}">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="search-item-badge ${f.type === 'class' ? 'badge-class' : 'badge-teacher'}">
              ${f.type === 'class' ? 'Classe' : 'Docente'}
            </span>
            <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">
              ${f.title || f.id}
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `).join('')}
    </div>
  `;

  DOM.mainContainer.querySelectorAll('[data-fav-type]').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.getAttribute('data-fav-type');
      const id = el.getAttribute('data-fav-id');
      navigateTo(type, id);
    });
  });

  const clearDefBtn = DOM.mainContainer.querySelector('#clearDefPrefBtn');
  if (clearDefBtn) {
    clearDefBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearDefaultView();
      showToast('Vista predefinita rimossa', 'info');
      renderFavoritesView();
    });
  }
}

/**
 * Gestione Bottom Navigation Bar.
 */
function setupBottomNav() {
  if (!DOM.bottomNav) return;
  DOM.bottomNav.querySelectorAll('.nav-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const navTarget = btn.getAttribute('data-nav');
      if (navTarget === 'search') {
        const input = document.getElementById('unifiedSearchInput');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (navTarget === 'radar') {
        navigateTo('radar');
      } else if (navTarget === 'subs') {
        navigateTo('subs');
      } else if (navTarget === 'favorites') {
        navigateTo('favorites');
      } else if (navTarget === 'settings') {
        if (settingsModal) settingsModal.open();
      } else {
        navigateTo('class');
      }
    });
  });
}

/**
 * Gestione deep linking tramite URL Search Params (?classe=, ?docente=, ?materia=, ?radar=).
 */
function handleInitialDeepLinking() {
  const urlParams = new URLSearchParams(window.location.search);
  const classeParam = urlParams.get('classe');
  const docenteParam = urlParams.get('docente');
  const materiaParam = urlParams.get('materia');
  const radarParam = urlParams.get('radar');

  if (classeParam) {
    navigateTo('class', classeParam);
    return true;
  }
  if (docenteParam) {
    navigateTo('teacher', docenteParam);
    return true;
  }
  if (materiaParam) {
    navigateTo('subject', materiaParam);
    return true;
  }
  if (radarParam) {
    state.radarTeacherId = radarParam;
    navigateTo('radar');
    return true;
  }
  return false;
}

/**
 * Caricamento dati e inizializzazione applicazione.
 */
async function bootstrap() {
  // 1. Registra Service Worker PWA
  registerServiceWorker();

  // 2. Applica tema
  setTheme(getTheme());

  // 3. Controlla se abbiamo XML in LocalStorage
  const cachedXml = getCachedXml();

  if (cachedXml) {
    try {
      console.log('⚡ [Bootstrap] Caricamento istantaneo da cache locale...');
      state.dataset = parseEDTXml(cachedXml);
      updateSyncStatus('syncing', 'Verifica...');
      initializeUI();
    } catch (parseErr) {
      console.warn('Errore parsing XML in cache, recupero nuovo XML:', parseErr);
      await loadFreshXml();
    }
  } else {
    // 4. Se non c'è cache, scarica subito l'XML
    await loadFreshXml();
  }

  // 5. Avvia controllo in background con snackbar per discrepanze
  runBackgroundSync();

  // 6. Timer periodico per Time Highlighting in tempo reale ogni 30 secondi
  startTimeWatcher(() => {
    if (state.dataset) {
      if (state.activeView === 'class' || state.activeView === 'teacher' || state.activeView === 'radar') {
        renderCurrentView();
      }
    }
  });
}

/**
 * Scarica l'XML fresco da proxy/fallback e inizializza l'interfaccia.
 */
async function loadFreshXml() {
  updateSyncStatus('syncing', 'Caricamento orario...');
  try {
    const xml = await fetchScheduleXml();
    saveXmlCache(xml);
    state.dataset = parseEDTXml(xml);
    updateSyncStatus('online', 'Orario aggiornato');
    initializeUI();
  } catch (err) {
    console.error('Errore irreversibile caricamento orario:', err);
    updateSyncStatus('offline', 'Offline');
    DOM.mainContainer.innerHTML = `
      <div class="state-container">
        <div class="state-icon"><span class="material-symbols-outlined" style="font-size: 36px; color: #ef4444;">error</span></div>
        <div class="state-title">Impossibile caricare l'orario</div>
        <div class="state-desc">${err.message}</div>
        <button class="btn-primary" onclick="window.location.reload()" style="max-width: 200px;">Riprova</button>
      </div>
    `;
  }
}

/**
 * Inizializza componenti UI dopo aver popolato il dataset.
 */
function initializeUI() {
  // Configura Search bar Spotlight
  searchComponent = setupUnifiedSearch({
    container: DOM.searchContainer,
    dataset: state.dataset,
    onSelect: (item) => {
      navigateTo(item.type, item.id);
    }
  });

  // Configura Modal Impostazioni
  settingsModal = setupSettingsModal({
    modalOverlay: DOM.settingsModalOverlay,
    dataset: state.dataset,
    onSyncRequest: () => {
      loadFreshXml();
    },
    onResetCache: () => {
      localStorage.clear();
      window.location.reload();
    }
  });

  if (DOM.settingsBtn) {
    DOM.settingsBtn.addEventListener('click', () => {
      if (settingsModal) settingsModal.open();
    });
  }

  // Tocco sul badge di sincronizzazione per forzare un controllo manuale
  if (DOM.syncStatusBadge) {
    DOM.syncStatusBadge.addEventListener('click', () => {
      updateSyncStatus('syncing', 'Verifica...');
      showToast('Controllo aggiornamenti orario in corso...', 'info', 2000);
      runBackgroundSync(true);
    });
  }

  setupBottomNav();

  // Controlla se c'è un deep link nella URL (es. ?classe=1A o ?docente=Rossi)
  const hadDeepLink = handleInitialDeepLinking();
  if (hadDeepLink) return;

  // Altrimenti verifica vista predefinita dell'utente (Default View)
  const defaultPref = getDefaultView();
  if (defaultPref && defaultPref.type && defaultPref.id) {
    navigateTo(defaultPref.type, defaultPref.id);
  } else {
    // Prima classe dell'elenco
    navigateTo('class', state.dataset.classes[0]?.short || '1A');
  }
}

/**
 * Esegue il silent background sync con notifica non distruttiva tramite snackbar.
 */
function runBackgroundSync(isManual = false) {
  checkBackgroundUpdate({
    onUpdateAvailable: ({ newXml, newHash }) => {
      showUpdateSnackbar({ newXml, newHash });
      updateSyncStatus('syncing', 'Nuova versione');
    },
    onNoChange: () => {
      updateSyncStatus('online', 'Orario sincronizzato');
      if (DOM.syncStatusBadge) {
        DOM.syncStatusBadge.title = 'Orario sincronizzato con il server remoto. Tocca per verificare.';
      }
      if (isManual) {
        showToast('Orario verificato: versione sincronizzata!', 'success', 2500);
      }
    },
    onError: (err) => {
      console.warn('Sync background non completato:', err.message);
      let label = 'Errore sync';
      if (err.message && err.message.includes('503')) {
        label = 'Server 503 (Offline)';
      } else if (!navigator.onLine) {
        label = 'Dispositivo offline';
      }
      updateSyncStatus('error', label);

      if (DOM.syncStatusBadge) {
        DOM.syncStatusBadge.title = `Sincronizzazione non riuscita: ${err.message}. Mostrati dati in cache. Tocca per riprovare.`;
      }

      if (isManual) {
        showToast(`Impossibile sincronizzare: ${err.message}`, 'warning', 4000);
      }
    }
  });
}

// Avvio applicazione
document.addEventListener('DOMContentLoaded', bootstrap);
