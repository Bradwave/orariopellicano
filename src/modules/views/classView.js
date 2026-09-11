/**
 * Vista Orario per Classe:
 * - Toggle fluido tra List View giornaliera e Weekly Grid View
 * - Fusione compatta delle lezioni di 2 ore (o pluriorarie) in singola scheda
 * - Color coding universale delle materie (Matematica = Blu, Fisica = Verde, ecc.)
 * - Menu azioni compatto [ ⋯ Azioni ] per mobile e desktop
 * - Esportazione iCalendar (.ics), condivisione nativa e stampa A4
 */

import { renderLocationBadge, renderCoDocenzaBadge } from './badges.js';
import { getCurrentScheduleState, getCurrentDayName } from '../time.js';
import { exportScheduleToIcs } from '../exportIcs.js';
import { shareSchedule } from '../share.js';
import { copyScheduleAsText, exportScheduleAsImage, shareScheduleImage } from '../exportManager.js';
import { getSubjectColor, getClassColorInfo, cleanSubjectName, formatDurationLabel, getGridSubjectName } from '../colors.js';

export function renderClassView({
  container,
  dataset,
  className,
  activeDay,
  viewMode = 'list', // 'list' | 'weekly'
  isFavorite = false,
  isDefault = false,
  onDayChange,
  onViewModeChange,
  onTeacherClick,
  onToggleFavorite,
  onSetDefault,
  onShowToast
}) {
  const classObj = dataset.classes.find(c => c.short === className) || { short: className, full: className };
  const scheduleForClass = dataset.byClass[className] || {};

  const realCurrentDay = getCurrentDayName();
  const currentDay = activeDay || (dataset.days.includes(realCurrentDay) ? realCurrentDay : dataset.days[0]);

  const timeState = getCurrentScheduleState(dataset.timeSlots);
  const isTodayActive = currentDay === realCurrentDay;
  const classColorInfo = getClassColorInfo(classObj.short, classObj.full);

  // Calcola totale ore settimanali della classe
  let totalHours = 0;
  dataset.days.forEach(d => {
    const dSlots = scheduleForClass[d] || {};
    Object.values(dSlots).forEach(acts => {
      acts.forEach(a => {
        if (!a.isContinuation) {
          totalHours += a.durataHours || 1;
        }
      });
    });
  });

  container.innerHTML = `
    <!-- Intestazione visibile ESCLUSIVAMENTE in fase di STAMPA (@media print) -->
    <div class="print-only-header">
      <div class="print-school-title">Liceo Statale • Orario delle Lezioni</div>
      <div class="print-meta">
        <span><strong>ORARIO CLASSE: ${classObj.full} (${classObj.short})</strong></span>
        <span>Generato il: ${new Date().toLocaleDateString('it-IT')} ore ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <!-- Active Entity Banner Compatto su Riga Singola -->
    <div class="active-view-banner">
      <div class="banner-title-group">
        <h1 class="banner-entity-name">${classObj.short}</h1>
        <span class="banner-meta-chip" style="color: ${classColorInfo.color}; border-color: ${classColorInfo.border}; background: ${classColorInfo.bg}; font-weight: 600;">
          ${classColorInfo.trackName}
        </span>
      </div>
      
      <div class="banner-actions">
        <button id="classFavBtn" class="icon-action-btn ${isFavorite ? 'favorited' : ''}" title="${isFavorite ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}" aria-label="Preferito">
          <span class="material-symbols-outlined" style="font-size: 19px;">${isFavorite ? 'star' : 'star_outline'}</span>
        </button>
        <button id="classDefaultBtn" class="icon-action-btn ${isDefault ? 'default-active' : ''}" title="${isDefault ? 'Vista predefinita attiva' : 'Imposta come vista predefinita all\'avvio'}" aria-label="Predefinito">
          <span class="material-symbols-outlined" style="font-size: 18px;">push_pin</span>
        </button>
        <div class="actions-dropdown-container">
          <button class="icon-action-btn" id="actionsDropdownTrigger" title="Altre azioni" aria-haspopup="true" aria-expanded="false" aria-label="Altre azioni">
            <span class="material-symbols-outlined" style="font-size: 20px;">more_horiz</span>
          </button>
          <div class="actions-dropdown-menu" id="actionsDropdownMenu" hidden>
            <div class="actions-dropdown-header">
              <div class="dropdown-header-stat">
                <span class="material-symbols-outlined" style="font-size: 15px; color: var(--accent-primary);">schedule</span>
                <span><strong>${totalHours}</strong> ore</span>
              </div>
            </div>
            <div class="actions-dropdown-divider"></div>
            <div class="dropdown-section-label">Condividi</div>
            <button class="dropdown-item-btn" id="classShareImgBtn">
              <span class="material-symbols-outlined">send</span>
              <span>Invia immagine</span>
            </button>
            <button class="dropdown-item-btn" id="classCopyTextBtn">
              <span class="material-symbols-outlined">content_copy</span>
              <span>Copia orario</span>
            </button>
            <button class="dropdown-item-btn" id="classShareBtn">
              <span class="material-symbols-outlined">share</span>
              <span>Condividi link</span>
            </button>
            <div class="actions-dropdown-divider"></div>
            <div class="dropdown-section-label">Esporta</div>
            <div class="export-buttons-row">
              <button class="export-compact-btn" id="classExportImgBtn" title="Scarica immagine PNG" aria-label="Scarica immagine">
                <span class="material-symbols-outlined">image</span>
              </button>
              <button class="export-compact-btn" id="classPrintBtn" title="Stampa o salva come PDF" aria-label="Stampa o salva come PDF">
                <span class="material-symbols-outlined">print</span>
              </button>
              <button class="export-compact-btn" id="classExportIcsBtn" title="Esporta calendario (.ics)" aria-label="Esporta calendario .ics">
                <span class="material-symbols-outlined">calendar_month</span>
                <span class="ext-badge">.ics</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Day Selector Pills (Attivo solo in List View) -->
    ${viewMode === 'list' ? `
      <div class="day-selector-container">
        <div class="day-pills-row" id="dayPillsRow">
          ${dataset.days.map(day => {
            const isActive = day === currentDay;
            const isToday = day === realCurrentDay;
            const dayShort = day.substring(0, 3);
            return `
              <button class="day-pill-btn ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}" data-day="${day}">
                <span class="day-short">${dayShort}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 1. Mobile-First Card Schedule List (Mostrata solo se viewMode === 'list') -->
    ${viewMode === 'list' ? `
      <div class="schedule-list" id="classScheduleList">
        ${renderDayCards({
          timeSlots: dataset.timeSlots,
          daySchedule: scheduleForClass[currentDay] || {},
          isTodayActive,
          currentSlotIndex: timeState.currentSlotIndex,
          remainingMinutes: timeState.remainingMinutes
        })}
      </div>
    ` : ''}

    <!-- Top Horizontal Scrollbar per Griglia Settimanale -->
    <div class="grid-scrollbar-top ${viewMode === 'weekly' ? 'visible' : ''}" id="classGridScrollTop">
      <div class="grid-scrollbar-track"></div>
    </div>

    <!-- 2. Desktop & Full Weekly CSS Grid (Mostrata se viewMode === 'weekly' oppure in stampa) -->
    <div class="weekly-grid-container ${viewMode === 'weekly' ? 'desktop-active' : ''}" id="classWeeklyGrid" style="${viewMode === 'weekly' ? 'display: block;' : ''}">
      <div class="weekly-grid">
        <div class="grid-header-cell empty-corner" aria-hidden="true"></div>
        ${dataset.days.map(d => `
          <div class="grid-header-cell ${d === realCurrentDay ? 'is-today' : ''}">${d}</div>
        `).join('')}

        ${dataset.timeSlots.map(slot => {
          let rowHtml = `
            <div class="grid-time-cell">
              <strong>${slot.index}ª ora</strong>
              <span>${slot.oInizio.replace('h', ':')}</span>
            </div>
          `;
          dataset.days.forEach(d => {
            const dayActs = (scheduleForClass[d] && scheduleForClass[d][slot.index]) || [];
            const isCurrentCell = (d === realCurrentDay && slot.index === timeState.currentSlotIndex);
            if (dayActs.length === 0) {
              rowHtml += `<div class="grid-content-cell empty-cell"></div>`;
            } else {
              const act = dayActs[0];
              const isDisp = act.isDisposizione;
              const colorObj = isDisp ? { color: '#b58900' } : getSubjectColor(act.matNome, act.matCod);
              const cleanName = isDisp ? 'Disposizione' : cleanSubjectName(act.matNome || act.matCod);
              const gridSubName = isDisp ? 'Disposizione' : getGridSubjectName(act.matNome, act.matCod);
              const teacherName = act.docCogn ? act.docCogn + (act.docNome ? ' ' + act.docNome : '') : (act.docente || '');
              rowHtml += `
                <div class="grid-content-cell ${isCurrentCell ? 'current-cell' : ''}" style="border-left: 3px solid ${colorObj.color};">
                  <div class="grid-cell-top">
                    <div class="grid-subject" title="${cleanName}" style="${isDisp ? 'color: var(--badge-disposizione-text); font-weight: 700;' : ''}">${gridSubName}</div>
                    <div class="grid-subtext" title="${teacherName}">${teacherName}</div>
                  </div>
                  <div class="grid-cell-bottom">
                    ${act.aula ? `<span class="badge badge-sede">${act.aula.includes('<') ? act.aula.replace(/[<>]/g, '') : 'Aula ' + act.aula}</span>` : ''}
                    ${renderLocationBadge(act.sede, '')}
                  </div>
                </div>
              `;
            }
          });
          return rowHtml;
        }).join('')}
      </div>
    </div>

    <!-- Floating View Mode Toggle (Centrato sopra la bottom nav) -->
    <div class="floating-view-toggle">
      <div class="view-mode-selector floating">
        <button class="view-mode-btn ${viewMode === 'list' ? 'active' : ''}" id="modeListBtn" title="Visualizzazione lista per giorno">
          <span class="material-symbols-outlined" style="font-size: 16px;">view_agenda</span>
          Lista
        </button>
        <button class="view-mode-btn ${viewMode === 'weekly' ? 'active' : ''}" id="modeWeeklyBtn" title="Visualizzazione griglia settimanale">
          <span class="material-symbols-outlined" style="font-size: 16px;">calendar_view_week</span>
          Settimana
        </button>
      </div>
    </div>
  `;

  // Sincronizzazione scroll orizzontale fluida tra la scrollbar superiore e la griglia
  const gridContainer = container.querySelector('#classWeeklyGrid');
  const gridScrollTop = container.querySelector('#classGridScrollTop');
  if (gridContainer && gridScrollTop) {
    const updateTrackWidth = () => {
      const grid = gridContainer.querySelector('.weekly-grid');
      const track = gridScrollTop.querySelector('.grid-scrollbar-track');
      if (grid && track) {
        track.style.width = grid.scrollWidth + 'px';
      }
    };
    updateTrackWidth();

    let rafId = null;
    let activeScroller = null;

    gridContainer.addEventListener('pointerdown', () => { activeScroller = 'container'; }, { passive: true });
    gridScrollTop.addEventListener('pointerdown', () => { activeScroller = 'top'; }, { passive: true });

    gridContainer.addEventListener('scroll', () => {
      if (activeScroller === 'top') return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        gridScrollTop.scrollLeft = gridContainer.scrollLeft;
      });
    }, { passive: true });

    gridScrollTop.addEventListener('scroll', () => {
      if (activeScroller === 'container') return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        gridContainer.scrollLeft = gridScrollTop.scrollLeft;
      });
    }, { passive: true });

    window.addEventListener('pointerup', () => { activeScroller = null; }, { passive: true });
  }

  // Listener Toggle View Mode
  const listBtn = container.querySelector('#modeListBtn');
  const weeklyBtn = container.querySelector('#modeWeeklyBtn');
  if (listBtn && weeklyBtn) {
    listBtn.addEventListener('click', () => {
      if (onViewModeChange) onViewModeChange('list');
    });
    weeklyBtn.addEventListener('click', () => {
      if (onViewModeChange) onViewModeChange('weekly');
    });
  }

  // Listener Dropdown Azioni Popover
  const actionsTrigger = container.querySelector('#actionsDropdownTrigger');
  const actionsMenu = container.querySelector('#actionsDropdownMenu');
  if (actionsTrigger && actionsMenu) {
    actionsTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = actionsMenu.hasAttribute('hidden');
      if (isHidden) {
        actionsMenu.removeAttribute('hidden');
        actionsTrigger.setAttribute('aria-expanded', 'true');
      } else {
        actionsMenu.setAttribute('hidden', '');
        actionsTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    // Chiusura al click esterno
    const handleOutsideClick = (e) => {
      if (!actionsTrigger.contains(e.target) && !actionsMenu.contains(e.target)) {
        actionsMenu.setAttribute('hidden', '');
        actionsTrigger.setAttribute('aria-expanded', 'false');
      }
    };
    document.addEventListener('click', handleOutsideClick);
  }

  // Listener cambio giorno
  const dayPills = container.querySelectorAll('.day-pill-btn');
  dayPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const day = pill.getAttribute('data-day');
      if (onDayChange) onDayChange(day);
    });
  });

  // Listener click su chip docente
  const teacherChips = container.querySelectorAll('.teacher-chip');
  teacherChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const tId = chip.getAttribute('data-teacher-id');
      if (onTeacherClick) onTeacherClick(tId);
    });
  });

  // Listener Condividi
  const shareBtn = container.querySelector('#classShareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const res = await shareSchedule({
        title: `Orario Classe ${classObj.short}`,
        text: `Consulta l'orario scolastico per la classe ${classObj.full}`,
        type: 'class',
        id: classObj.short
      });
      if (res.success && res.method === 'clipboard' && onShowToast) {
        onShowToast(`Link classe ${classObj.short} copiato negli appunti!`, 'success');
      }
    });
  }

  // Listener Copia Testo
  const copyTextBtn = container.querySelector('#classCopyTextBtn');
  if (copyTextBtn) {
    copyTextBtn.addEventListener('click', async () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const ok = await copyScheduleAsText({
        title: `Classe ${classObj.short}`,
        type: 'class',
        scheduleData: scheduleForClass,
        timeSlots: dataset.timeSlots,
        days: dataset.days
      });
      if (ok && onShowToast) {
        onShowToast(`Orario classe ${classObj.short} copiato!`, 'success');
      }
    });
  }

  // Listener Invia Immagine
  const shareImgBtn = container.querySelector('#classShareImgBtn');
  if (shareImgBtn) {
    shareImgBtn.addEventListener('click', async () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const res = await shareScheduleImage({
        title: `Classe ${classObj.short}`,
        type: 'class',
        scheduleData: scheduleForClass,
        timeSlots: dataset.timeSlots,
        days: dataset.days
      });
      if (res.success && onShowToast) {
        if (res.method === 'clipboard') {
          onShowToast('Immagine copiata negli appunti!', 'success');
        } else if (res.method === 'download') {
          onShowToast(`Condivisione non supportata: immagine scaricata!`, 'success');
        }
      }
    });
  }

  // Listener Esporta Immagine PNG
  const exportImgBtn = container.querySelector('#classExportImgBtn');
  if (exportImgBtn) {
    exportImgBtn.addEventListener('click', async () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const filename = await exportScheduleAsImage({
        title: `Classe ${classObj.short}`,
        type: 'class',
        scheduleData: scheduleForClass,
        timeSlots: dataset.timeSlots,
        days: dataset.days
      });
      if (filename && onShowToast) {
        onShowToast(`Immagine ${filename} scaricata!`, 'success');
      }
    });
  }

  // Listener Esporta .ICS
  const icsBtn = container.querySelector('#classExportIcsBtn');
  if (icsBtn) {
    icsBtn.addEventListener('click', () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const filename = exportScheduleToIcs({
        title: `Classe_${classObj.short}`,
        type: 'class',
        scheduleData: scheduleForClass,
        timeSlots: dataset.timeSlots,
        days: dataset.days
      });
      if (filename && onShowToast) {
        onShowToast(`File ${filename} scaricato!`, 'success');
      }
    });
  }

  // Listener Stampa
  const printBtn = container.querySelector('#classPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      window.print();
    });
  }

  // Preferito
  const favBtn = container.querySelector('#classFavBtn');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      if (onToggleFavorite) onToggleFavorite('class', classObj.short, `Classe ${classObj.short}`);
    });
  }

  // Default
  const defBtn = container.querySelector('#classDefaultBtn');
  if (defBtn) {
    defBtn.addEventListener('click', () => {
      if (onSetDefault) onSetDefault('class', classObj.short, `Classe ${classObj.short}`);
    });
  }
}

/**
 * Renderizza le schede giornaliere con fusione compatta delle lezioni di 2 ore (o pluriorarie),
 * color coding per materia e rimozione del codice materia ridondante.
 */
function renderDayCards({ timeSlots, daySchedule, isTodayActive, currentSlotIndex, remainingMinutes }) {
  if (!timeSlots || timeSlots.length === 0) {
    return `<div class="state-container"><div class="state-title">Nessuna fascia oraria disponibile</div></div>`;
  }

  const renderedHtml = [];
  const skippedSlotIndices = new Set();

  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];
    if (skippedSlotIndices.has(slot.index)) {
      continue;
    }

    const acts = daySchedule[slot.index] || [];
    const isCurrentDirect = isTodayActive && (slot.index === currentSlotIndex);

    if (acts.length === 0) {
      renderedHtml.push(`
        <div class="hour-card empty-hour ${isCurrentDirect ? 'current-hour' : ''}">
          ${isCurrentDirect ? `
            <div class="current-hour-pill">
              <span class="pulse-dot-live"></span>
              ORA ATTUALE ${remainingMinutes ? `(-${remainingMinutes} min)` : ''}
            </div>
          ` : ''}
          <div class="hour-card-header">
            <div class="hour-slot-badge">
              <span class="slot-number">${slot.index}ª ora</span>
              <span class="slot-time">${slot.timeFormatted}</span>
            </div>
          </div>
          <div class="empty-hour-text">Nessuna lezione in programma</div>
        </div>
      `);
      continue;
    }

    // Identifica l'attività principale della lezione
    const nonContinuationActs = acts.filter(a => !a.isContinuation);
    const mainAct = nonContinuationActs[0] || acts[0];
    const span = Math.max(1, mainAct.durataHours || 1);

    // Calcola l'ora finale in caso di lezione plurioraria (es. 2 ore)
    let endSlot = slot;
    if (span > 1) {
      const targetEndIndex = slot.index + span - 1;
      const foundEnd = timeSlots.find(s => s.index === targetEndIndex);
      if (foundEnd) {
        endSlot = foundEnd;
      }
      // Registra gli slot successivi da non ri-renderizzare singolarmente
      for (let s = 1; s < span; s++) {
        skippedSlotIndices.add(slot.index + s);
      }
    }

    // Slot badge label ed orario esteso
    const slotLabel = span > 1 ? `${slot.index}ª - ${endSlot.index}ª ora` : `${slot.index}ª ora`;
    const timeLabel = `${slot.startTimeFormatted} - ${endSlot.endTimeFormatted}`;

    // La lezione è in corso se l'ora attuale cade all'interno dell'intervallo fuso
    const isCurrent = isTodayActive && (currentSlotIndex >= slot.index && currentSlotIndex <= endSlot.index);

    // Color coding e pulizia nome materia
    const subjectColor = getSubjectColor(mainAct.matNome, mainAct.matCod);
    const cleanName = cleanSubjectName(mainAct.matNome || mainAct.matCod);
    // Docenti (inclusi eventuali colleghi in co-docenza)
    const teachersList = acts.map(a => a.teacherDisplayName).filter(Boolean);
    const isMultipleTeachers = teachersList.length > 1;
    const locationBadges = renderLocationBadge(mainAct.sede, mainAct.aula);
    const coDocenzaBadges = (isMultipleTeachers || mainAct.isCoDocenza) ? renderCoDocenzaBadge(teachersList) : '';
    const hasFooter = Boolean(locationBadges || coDocenzaBadges);

    renderedHtml.push(`
      <div class="hour-card ${isCurrent ? 'current-hour' : ''}" style="border-left: 3px solid ${subjectColor.color};">
        ${isCurrent ? `
          <div class="current-hour-pill">
            <span class="pulse-dot-live"></span>
            IN CORSO ${remainingMinutes ? `(-${remainingMinutes} min)` : ''}
          </div>
        ` : ''}
        
        <div class="hour-card-header">
          <div class="hour-slot-badge">
            <span class="slot-number">${slotLabel}</span>
            <span class="slot-time">${timeLabel}</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: flex-end;">
            ${acts.map(a => a.teacherId ? `
              <span class="teacher-chip" data-teacher-id="${a.teacherId}" title="Apri orario docente">
                <span class="material-symbols-outlined" style="font-size: 14px;">person</span>
                ${a.teacherDisplayName}
              </span>
            ` : '').join('')}
          </div>
        </div>

        <div class="hour-card-body">
          <div class="subject-row">
            <div class="subject-name">${cleanName}</div>
          </div>
        </div>

        ${hasFooter ? `
          <div class="hour-card-footer">
            <div class="badges-group" style="margin-left: auto;">
              ${coDocenzaBadges}
              ${locationBadges}
            </div>
          </div>
        ` : ''}
      </div>
    `);
  }

  return renderedHtml.join('');
}
