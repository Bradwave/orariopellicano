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
  setTheme,
  getViewModePreference,
  setViewModePreference,
  getNextUpPreference
} from './modules/storage.js';
import { fetchScheduleXml, checkBackgroundUpdate } from './modules/api.js';
import { startTimeWatcher, getCurrentScheduleState, getCurrentDayName } from './modules/time.js';
import { getHolidayOrVacation } from './modules/calendar.js';
import { getIcon } from './modules/icons.js';
import { getGridSubjectName, getClassColorInfo, getSubjectColor } from './modules/colors.js';

import { setupUnifiedSearch } from './modules/views/search.js';
import { renderClassView } from './modules/views/classView.js';
import { renderTeacherView } from './modules/views/teacherView.js';
import { renderSubjectView } from './modules/views/subjectView.js';
import { renderSubsDashboard } from './modules/views/subsView.js';
import { renderRadarView } from './modules/views/radarView.js';
import { setupSettingsModal } from './modules/views/settingsModal.js';
import { loadThemeConfig } from './modules/themeManager.js';

// Stato reattivo dell'applicazione
const state = {
  dataset: null,
  activeView: 'class', // 'class' | 'teacher' | 'subject' | 'subs' | 'radar' | 'favorites'
  activeId: null,
  activeDay: null,
  viewMode: getViewModePreference(),    // 'list' | 'weekly' persistito
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
  syncIcon: document.getElementById('syncIcon'),
  favsDropdownToggleBtn: document.getElementById('favsDropdownToggleBtn'),
  favsChevron: document.getElementById('favsChevron'),
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
 * Aggiorna il badge dello stato di sincronizzazione nell'header con Material Symbol.
 */
function updateSyncStatus(status, tooltipText) {
  if (DOM.syncStatusBadge) {
    DOM.syncStatusBadge.className = 'sync-status-badge ' + status;
    DOM.syncStatusBadge.title = tooltipText || 'Stato sincronizzazione orario';
  }

  if (DOM.syncIcon) {
    DOM.syncIcon.className = 'material-symbols-outlined sync-icon ' + status;
    if (status === 'syncing') {
      DOM.syncIcon.textContent = 'sync';
    } else if (status === 'error') {
      DOM.syncIcon.textContent = 'sync_problem';
    } else if (status === 'offline') {
      DOM.syncIcon.textContent = 'cloud_off';
    } else if (status === 'online') {
      DOM.syncIcon.textContent = 'cloud_done';
    }
  }

  if (settingsModal && settingsModal.setSyncStatus) {
    settingsModal.setSyncStatus(status, null, tooltipText);
  }
}

/**
 * Renderizza i Quick Pills (preferiti) nel dropdown sotto la search bar.
 */
function renderQuickPills() {
  if (!DOM.quickPillsBar || !state.dataset) return;
  const favs = getFavorites();

  if (favs.length === 0) {
    DOM.quickPillsBar.innerHTML = `
      <span class="quick-pills-empty">Nessun preferito salvato. Aggiungi con la stella ⭐</span>
    `;
    return;
  }

  const pillsData = favs.map(f => ({
    type: f.type,
    id: f.id,
    label: `<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: -2px; margin-right: 3px;">star</span>${f.id}`,
    active: state.activeView === f.type && state.activeId === f.id
  }));

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
  let targetView = viewType;
  let targetId = id || state.activeId;

  // Auto-rilevamento tipo entità se l'id fornito appartiene inequivocabilmente a docenti o classi
  if (targetId && state.dataset) {
    const isTeacher = state.dataset.teachers?.some(t => t.id === targetId);
    const isClass = state.dataset.classes?.some(c => c.short === targetId);
    if (targetView === 'class' && isTeacher && !isClass) {
      targetView = 'teacher';
    } else if (targetView === 'teacher' && isClass && !isTeacher) {
      targetView = 'class';
    }
  }

  const previousView = state.activeView;
  const previousId = state.activeId;

  state.activeView = targetView;
  if (day) state.activeDay = day;

  // Gestione defaults e garanzia di integrità dell'id per il tipo di vista (con matching tollerante case-insensitive)
  if (targetView === 'class') {
    const targetQ = (targetId || '').trim().toLowerCase();
    const matched = state.dataset?.classes?.find(c => c.short.toLowerCase() === targetQ || c.full.toLowerCase() === targetQ);
    if (matched) {
      targetId = matched.short;
    } else {
      const def = getDefaultView();
      targetId = (def && def.type === 'class') ? def.id : (state.lastClassId || state.dataset?.classes?.[0]?.short || '1A');
    }
    state.lastClassId = targetId;
    state.activeId = targetId;
  } else if (targetView === 'teacher') {
    const targetQ = (targetId || '').trim().toLowerCase();
    const matched = state.dataset?.teachers?.find(t => 
      t.id.toLowerCase() === targetQ || 
      t.cognome.toLowerCase() === targetQ || 
      t.displayName.toLowerCase() === targetQ
    );
    if (matched) {
      targetId = matched.id;
    } else {
      const def = getDefaultView();
      targetId = (def && def.type === 'teacher') ? def.id : (state.lastTeacherId || state.dataset?.teachers?.[0]?.id || '');
    }
    state.lastTeacherId = targetId;
    state.activeId = targetId;
  } else if (targetView === 'subject') {
    const targetQ = (targetId || '').trim().toLowerCase();
    const matched = state.dataset?.subjects?.find(s => s.code.toLowerCase() === targetQ || s.name.toLowerCase() === targetQ);
    if (matched) {
      targetId = matched.code;
    } else {
      targetId = state.dataset?.subjects?.[0]?.code || '';
    }
    state.activeId = targetId;
  } else if (targetView === 'radar') {
    if (id) {
      state.radarTeacherId = id;
    } else if (previousView === 'teacher' && previousId) {
      // Se nella vista orario era selezionato un docente, usalo come punto di partenza
      state.radarTeacherId = previousId;
    } else if (state.lastTeacherId) {
      state.radarTeacherId = state.lastTeacherId;
    } else {
      state.radarTeacherId = null;
    }
  } else {
    if (id) state.activeId = id;
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
  const isScheduleView = ['class', 'teacher', 'subject'].includes(state.activeView);
  DOM.bottomNav.querySelectorAll('.nav-item-btn').forEach(btn => {
    const target = btn.getAttribute('data-nav');
    const isActive = ((target === 'schedule' || target === 'class') && isScheduleView) || target === state.activeView;
    if (isActive) {
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
          setViewModePreference(mode);
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
          setViewModePreference(mode);
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

  // Renderizza la card "Prossima Lezione" (Next-Up) se abilitata nelle impostazioni
  renderNextUpCard();
}

/**
 * Renderizza la card "Prossima Lezione" (Next-Up) in cima alla vista orario se abilitata.
 */
function renderNextUpCard() {
  if (!getNextUpPreference() || !state.dataset) return;

  const targetType = state.activeView === 'class' ? 'class' : (state.activeView === 'teacher' ? 'teacher' : null);
  if (!targetType) return;

  const targetId = state.activeId;
  const targetSchedule = targetType === 'class' 
    ? (state.dataset.byClass[targetId] || {})
    : (state.dataset.byTeacher[targetId] || {});

  const now = new Date();
  const holidayCheck = getHolidayOrVacation(now);
  const realDay = getCurrentDayName(now);
  const timeState = getCurrentScheduleState(state.dataset.timeSlots, now);

  let activeAct = null;
  let label = '';
  let countdownText = '';

  // 1. Controllo in tempo reale durante le ore scolastiche attive
  if (!holidayCheck.isHoliday && realDay !== 'domenica' && timeState.status !== 'after_school' && timeState.status !== 'outside') {
    const daySchedule = targetSchedule[realDay] || {};
    if (timeState.status === 'in_progress' && timeState.currentSlot) {
      const currentActs = daySchedule[timeState.currentSlot.index] || [];
      if (currentActs.length > 0) {
        activeAct = currentActs[0];
        label = 'In corso';
        countdownText = `-${timeState.remainingMinutes} min`;
      }
    } else if (timeState.status === 'break' && timeState.nextSlot) {
      const nextActs = daySchedule[timeState.nextSlot.index] || [];
      if (nextActs.length > 0) {
        activeAct = nextActs[0];
        label = timeState.breakName || 'Intervallo';
        countdownText = `tra ${timeState.remainingMinutes} min`;
      }
    } else if (timeState.status === 'before_school') {
      const firstSlot = state.dataset.timeSlots[0];
      const firstActs = daySchedule[firstSlot.index] || [];
      if (firstActs.length > 0) {
        activeAct = firstActs[0];
        label = '1ª Ora';
        countdownText = `alle ${firstSlot.startTimeFormatted}`;
      }
    }
  }

  // 2. Anteprima temporanea (quando fuori orario scolastico, weekend o vacanza)
  if (!activeAct) {
    const currentViewDay = state.currentDay || 'lunedi';
    const daysToCheck = [currentViewDay, 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
    for (const d of daysToCheck) {
      const daySlots = targetSchedule[d] || {};
      for (const slot of state.dataset.timeSlots) {
        if (daySlots[slot.index] && daySlots[slot.index].length > 0) {
          activeAct = daySlots[slot.index][0];
          label = 'Prossima';
          countdownText = `tra 10 min • ${slot.startTimeFormatted}`;
          break;
        }
      }
      if (activeAct) break;
    }
  }

  if (!activeAct) return;

  const shortSubject = activeAct.isDisposizione 
    ? 'Disposizione' 
    : getGridSubjectName(activeAct.matNome || '', activeAct.matCod || '');

  const classLabel = activeAct.classeShort || (targetType === 'class' ? targetId : '');

  const where = [
    activeAct.aula ? (activeAct.aula.includes('<') ? activeAct.aula.replace(/[<>]/g, '') : `Aula ${activeAct.aula}`) : '',
    (activeAct.sede && activeAct.sede !== 'DISPOSIZIONE') ? activeAct.sede : ''
  ].filter(Boolean).join(' • ');

  const who = targetType === 'class'
    ? (activeAct.teacherDisplayName ? activeAct.teacherDisplayName : '')
    : (activeAct.isCoDocenza && activeAct.coDocenti ? `Co-docenza: ${activeAct.coDocenti}` : '');

  const detailsText = [who, where].filter(Boolean).join(' • ');

  let classHtml = '';
  if (classLabel) {
    const cInfo = getClassColorInfo(classLabel, activeAct.classeFull || '');
    classHtml = `<span class="class-chip next-up-class-chip" data-class-name="${classLabel}" style="color: ${cInfo.color}; border: 1px solid ${cInfo.color}; background: ${cInfo.bg}; font-weight: 700; font-size: 0.78rem; padding: 2px 7px; border-radius: 4px;" title="Classe ${classLabel}">${classLabel}</span>`;
  }

  const subjectColor = activeAct.isDisposizione
    ? { color: 'var(--badge-disposizione-text, #b58900)' }
    : getSubjectColor(activeAct.matNome || '', activeAct.matCod || '');

  const card = document.createElement('div');
  card.className = 'next-up-card';
  card.innerHTML = `
    <div class="next-up-left">
      <span class="next-up-tag">${label}</span>
      <span class="next-up-countdown">${countdownText}</span>
    </div>
    <div class="next-up-right">
      <span class="next-up-subject">${shortSubject}</span>
      ${classHtml}
    </div>
  `;

  if (targetType === 'teacher' && classLabel) {
    const chip = card.querySelector('.next-up-class-chip');
    if (chip) {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateTo('class', classLabel);
      });
    }
  }

  const listContainer = DOM.mainContainer.querySelector('.schedule-list');
  const gridScroll = DOM.mainContainer.querySelector('.grid-scrollbar-top');
  const gridContainer = DOM.mainContainer.querySelector('.schedule-grid-container');

  if (listContainer) {
    listContainer.prepend(card);
  } else if (gridScroll) {
    gridScroll.parentNode.insertBefore(card, gridScroll);
  } else if (gridContainer) {
    gridContainer.parentNode.insertBefore(card, gridContainer);
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
      <div class="banner-title-group">
        <h1 class="banner-entity-name">I tuoi preferiti</h1>
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
 * Estrae i parametri di deep linking da window.location.search o window.location.hash.
 */
function getDeepLinkParams() {
  let params = new URLSearchParams(window.location.search);
  if (!params.has('classe') && !params.has('docente') && !params.has('materia') && !params.has('radar')) {
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      params = new URLSearchParams(hash.substring(hash.indexOf('?')));
    } else if (hash.includes('=')) {
      params = new URLSearchParams(hash.replace(/^#\/?/, ''));
    }
  }
  return params;
}

/**
 * Gestione deep linking tramite URL Search Params (?classe=, ?docente=, ?materia=, ?radar=).
 * Indirizza alla risorsa richiesta e pulisce l'URL nel browser per mantenere la barra pulita.
 */
function handleInitialDeepLinking() {
  const urlParams = getDeepLinkParams();
  const classeParam = urlParams.get('classe');
  const docenteParam = urlParams.get('docente');
  const materiaParam = urlParams.get('materia');
  const radarParam = urlParams.get('radar');

  let handled = false;

  if (classeParam && state.dataset?.classes) {
    const q = classeParam.trim().toLowerCase();
    const found = state.dataset.classes.find(c => 
      c.short.toLowerCase() === q || 
      c.full.toLowerCase() === q
    );
    if (found) {
      navigateTo('class', found.short);
      handled = true;
    }
  } else if (docenteParam && state.dataset?.teachers) {
    const q = docenteParam.trim().toLowerCase();
    const found = state.dataset.teachers.find(t => 
      t.id.toLowerCase() === q || 
      t.cognome.toLowerCase() === q || 
      t.displayName.toLowerCase() === q
    );
    if (found) {
      navigateTo('teacher', found.id);
      handled = true;
    }
  } else if (materiaParam && state.dataset?.subjects) {
    const q = materiaParam.trim().toLowerCase();
    const found = state.dataset.subjects.find(s => 
      s.code.toLowerCase() === q || 
      s.name.toLowerCase() === q
    );
    if (found) {
      navigateTo('subject', found.code);
      handled = true;
    }
  } else if (radarParam && state.dataset?.teachers) {
    const q = radarParam.trim().toLowerCase();
    const found = state.dataset.teachers.find(t => 
      t.id.toLowerCase() === q || 
      t.cognome.toLowerCase() === q || 
      t.displayName.toLowerCase() === q
    );
    if (found) {
      state.radarTeacherId = found.id;
      navigateTo('radar');
      handled = true;
    }
  }

  if (handled) {
    // Pulisci l'URL nel browser per eliminare la query string mantenendo attiva la vista
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, document.title, cleanUrl);
    } catch (_) {}
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

  // 2. Carica configurazione temi da JSON e applica tema
  await loadThemeConfig();
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
      updateSyncStatus('syncing', 'Verifica in corso...');
      showToast('Controllo aggiornamenti orario in corso...', 'info', 2000);
      runBackgroundSync(true);
    },
    onResetCache: () => {
      localStorage.clear();
      window.location.reload();
    },
    onNextUpChange: () => {
      renderCurrentView();
    }
  });

  if (DOM.settingsBtn) {
    DOM.settingsBtn.addEventListener('click', () => {
      if (settingsModal) settingsModal.open();
    });
  }

  // Toggle a scomparsa della barra preferiti
  if (DOM.favsDropdownToggleBtn && DOM.quickPillsBar) {
    DOM.favsDropdownToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = DOM.quickPillsBar.classList.toggle('open');
      DOM.favsDropdownToggleBtn.classList.toggle('open', isOpen);
      DOM.favsDropdownToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      try {
        localStorage.setItem('orario_pellicano_favs_open', isOpen ? 'true' : 'false');
      } catch (_) {}
    });

    const wasOpen = localStorage.getItem('orario_pellicano_favs_open') === 'true';
    if (wasOpen) {
      DOM.quickPillsBar.classList.add('open');
      DOM.favsDropdownToggleBtn.classList.add('open');
      DOM.favsDropdownToggleBtn.setAttribute('aria-expanded', 'true');
    }
  }

  // Tocco sul badge di sincronizzazione per forzare un controllo manuale
  if (DOM.syncStatusBadge) {
    DOM.syncStatusBadge.addEventListener('click', () => {
      updateSyncStatus('syncing', 'Verifica in corso...');
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
 * Esegue il silent background sync con notifica non bloccante a tema.
 */
function runBackgroundSync(isManual = false) {
  checkBackgroundUpdate({
    onUpdateAvailable: ({ newXml, newHash }) => {
      try {
        saveXmlCache(newXml, newHash);
        state.dataset = parseEDTXml(newXml);
        updateSyncStatus('online', 'Orario sincronizzato con il server');
        renderCurrentView();
        renderQuickPills();
        if (settingsModal) settingsModal.updateStats();
        showToast('Orario aggiornato all\'ultima versione dalla segreteria', 'info', 3500);
      } catch (err) {
        console.error('Errore aggiornamento automatico orario:', err);
        updateSyncStatus('error', 'Errore applicazione orario');
      }
    },
    onNoChange: () => {
      updateSyncStatus('online', 'Orario sincronizzato con il server');
      if (settingsModal) settingsModal.updateStats();
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
      if (settingsModal) settingsModal.updateStats();

      if (isManual) {
        showToast(`Impossibile sincronizzare: ${err.message}`, 'warning', 4000);
      }
    }
  });
}

// Avvio applicazione
document.addEventListener('DOMContentLoaded', bootstrap);
