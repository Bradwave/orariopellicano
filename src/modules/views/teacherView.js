/**
 * Vista Orario per Docente:
 * - Toggle fluido tra List View giornaliera e Weekly Grid View
 * - Fusione compatta delle lezioni di 2 ore (o pluriorarie) in singola scheda
 * - Gestione ore a DISPOSIZIONE e co-docenze
 * - Color coding universale per materia / classe
 * - Menu azioni compatto [ ⋯ Azioni ] con Radar colleghi, .ICS, condivisione e stampa
 */

import { renderLocationBadge, renderCoDocenzaBadge } from './badges.js';
import { getCurrentScheduleState, getCurrentDayName } from '../time.js';
import { exportScheduleToIcs } from '../exportIcs.js';
import { shareSchedule } from '../share.js';
import { copyScheduleAsText, exportScheduleAsImage, shareScheduleImage } from '../exportManager.js';
import { getSubjectColor, cleanSubjectName, formatDurationLabel, getClassColor, getClassColorInfo, getGridSubjectName } from '../colors.js';

export function renderTeacherView({
  container,
  dataset,
  teacherId,
  activeDay,
  viewMode = 'list', // 'list' | 'weekly'
  isFavorite = false,
  isDefault = false,
  onDayChange,
  onViewModeChange,
  onClassClick,
  onRadarClick,
  onToggleFavorite,
  onSetDefault,
  onShowToast
}) {
  const teacher = dataset.teachers.find(t => t.id === teacherId) || { id: teacherId, displayName: teacherId };
  const scheduleForTeacher = dataset.byTeacher[teacherId] || {};

  const realCurrentDay = getCurrentDayName();
  const currentDay = activeDay || (dataset.days.includes(realCurrentDay) ? realCurrentDay : dataset.days[0]);

  const timeState = getCurrentScheduleState(dataset.timeSlots);
  const isTodayActive = currentDay === realCurrentDay;

  // Calcola statistiche docente
  let totalHours = 0;
  let disposizioniCount = 0;
  dataset.days.forEach(d => {
    const dSlots = scheduleForTeacher[d] || {};
    Object.values(dSlots).forEach(acts => {
      acts.forEach(a => {
        if (!a.isContinuation) {
          totalHours += a.durataHours || 1;
          if (a.isDisposizione) disposizioniCount += a.durataHours || 1;
        }
      });
    });
  });

  container.innerHTML = `
    <!-- Intestazione visibile ESCLUSIVAMENTE in fase di STAMPA (@media print) -->
    <div class="print-only-header">
      <div class="print-school-title">Liceo Statale • Orario Docenti</div>
      <div class="print-meta">
        <span><strong>ORARIO DOCENTE: ${teacher.displayName}</strong> (${totalHours} ore settimanali, ${disposizioniCount} a disposizione)</span>
        <span>Generato il: ${new Date().toLocaleDateString('it-IT')} ore ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <!-- Active Entity Banner Compatto su Riga Singola -->
    <div class="active-view-banner">
      <div class="banner-title-group">
        <h1 class="banner-entity-name">${teacher.displayName}</h1>
      </div>
      
      <div class="banner-actions">
        <button id="teacherFavBtn" class="icon-action-btn ${isFavorite ? 'favorited' : ''}" title="${isFavorite ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}" aria-label="Preferito">
          <span class="material-symbols-outlined" style="font-size: 19px;">${isFavorite ? 'star' : 'star_outline'}</span>
        </button>
        <button id="teacherDefaultBtn" class="icon-action-btn ${isDefault ? 'default-active' : ''}" title="${isDefault ? 'Vista predefinita attiva' : 'Imposta come vista predefinita all\'avvio'}" aria-label="Predefinito">
          <span class="material-symbols-outlined" style="font-size: 18px;">push_pin</span>
        </button>
        <div class="actions-dropdown-container">
          <button class="icon-action-btn" id="teacherActionsTrigger" title="Altre azioni" aria-haspopup="true" aria-expanded="false" aria-label="Altre azioni">
            <span class="material-symbols-outlined" style="font-size: 20px;">more_horiz</span>
          </button>
          <div class="actions-dropdown-menu" id="teacherActionsMenu" hidden>
            <div class="actions-dropdown-header">
              <div class="dropdown-header-stat">
                <span class="material-symbols-outlined" style="font-size: 15px; color: var(--accent-primary);">schedule</span>
                <span><strong>${totalHours}</strong> ore</span>
              </div>
              ${disposizioniCount > 0 ? `
                <div class="dropdown-header-stat" style="color: var(--badge-disposizione-text);">
                  <span class="material-symbols-outlined" style="font-size: 15px;">swap_horiz</span>
                  <span><strong>${disposizioniCount}</strong> a disposizione</span>
                </div>
              ` : ''}
            </div>
            <div class="actions-dropdown-divider"></div>
            <button class="dropdown-item-btn" id="teacherRadarBtn" style="color: var(--accent-primary);">
              <span class="material-symbols-outlined" style="color: var(--accent-primary);">radar</span>
              <span>Radar colleghi</span>
            </button>
            <div class="actions-dropdown-divider"></div>
            <div class="dropdown-section-label">Condividi</div>
            <button class="dropdown-item-btn" id="teacherShareImgBtn">
              <span class="material-symbols-outlined">send</span>
              <span>Invia immagine</span>
            </button>
            <button class="dropdown-item-btn" id="teacherCopyTextBtn">
              <span class="material-symbols-outlined">content_copy</span>
              <span>Copia orario</span>
            </button>
            <button class="dropdown-item-btn" id="teacherShareBtn">
              <span class="material-symbols-outlined">share</span>
              <span>Condividi link</span>
            </button>
            <div class="actions-dropdown-divider"></div>
            <div class="dropdown-section-label">Esporta</div>
            <div class="export-buttons-row">
              <button class="export-compact-btn" id="teacherExportImgBtn" title="Scarica immagine PNG" aria-label="Scarica immagine">
                <span class="material-symbols-outlined">image</span>
              </button>
              <button class="export-compact-btn" id="teacherPrintBtn" title="Stampa o salva come PDF" aria-label="Stampa o salva come PDF">
                <span class="material-symbols-outlined">print</span>
              </button>
              <button class="export-compact-btn" id="teacherExportIcsBtn" title="Esporta calendario (.ics)" aria-label="Esporta calendario .ics">
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
        <div class="day-pills-row">
          ${dataset.days.map(day => {
            const isActive = day === currentDay;
            const isToday = day === realCurrentDay;
            return `
              <button class="day-pill-btn ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}" data-day="${day}">
                <span class="day-short">${day.substring(0, 3)}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 1. Mobile-First Card Schedule List (Mostrata solo se viewMode === 'list') -->
    ${viewMode === 'list' ? `
      <div class="schedule-list" id="teacherScheduleList">
        ${renderTeacherDayCards({
          timeSlots: dataset.timeSlots,
          daySchedule: scheduleForTeacher[currentDay] || {},
          isTodayActive,
          currentSlotIndex: timeState.currentSlotIndex,
          remainingMinutes: timeState.remainingMinutes
        })}
      </div>
    ` : ''}

    <!-- Top Horizontal Scrollbar per Griglia Settimanale -->
    <div class="grid-scrollbar-top ${viewMode === 'weekly' ? 'visible' : ''}" id="teacherGridScrollTop">
      <div class="grid-scrollbar-track"></div>
    </div>

    <!-- 2. Desktop & Full Weekly CSS Grid (Mostrata se viewMode === 'weekly' oppure in stampa) -->
    <div class="weekly-grid-container ${viewMode === 'weekly' ? 'desktop-active' : ''}" id="teacherWeeklyGrid" style="${viewMode === 'weekly' ? 'display: block;' : ''}">
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
            const dayActs = (scheduleForTeacher[d] && scheduleForTeacher[d][slot.index]) || [];
            const isCurrentCell = (d === realCurrentDay && slot.index === timeState.currentSlotIndex);
            if (dayActs.length === 0) {
              rowHtml += `<div class="grid-content-cell empty-cell"></div>`;
            } else {
              const act = dayActs[0];
              const isDisp = act.isDisposizione;
              const colorObj = isDisp ? { color: '#b58900' } : getSubjectColor(act.matNome, act.matCod);
              const cleanName = isDisp ? 'Disposizione' : cleanSubjectName(act.matNome || act.matCod);
              const gridSubName = isDisp ? 'Disposizione' : getGridSubjectName(act.matNome, act.matCod);
              const classInfo = (!isDisp && act.classeShort) ? getClassColorInfo(act.classeShort, act.classeFull || '') : null;
              const classLabel = isDisp ? '' : (act.classeShort || '');
              const classColor = classInfo ? classInfo.color : 'var(--text-muted)';
              rowHtml += `
                <div class="grid-content-cell ${isCurrentCell ? 'current-cell' : ''}" style="border-left: 3px solid ${colorObj.color};">
                  <div class="grid-cell-top">
                    <div class="grid-subject" title="${cleanName}" style="${isDisp ? 'color: var(--badge-disposizione-text); font-weight: 700;' : ''}">${gridSubName}</div>
                    ${classLabel ? `<div class="grid-subtext" title="${classLabel}" style="color: ${classColor}; font-weight: 600;">${classLabel}</div>` : ''}
                  </div>
                  <div class="grid-cell-bottom">
                    ${(!isDisp && act.aula) ? `<span class="badge badge-sede">${act.aula.includes('<') ? act.aula.replace(/[<>]/g, '') : 'Aula ' + act.aula}</span>` : ''}
                    ${(!isDisp && act.sede && act.sede !== 'DISPOSIZIONE') ? renderLocationBadge(act.sede, '') : ''}
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
  const gridContainer = container.querySelector('#teacherWeeklyGrid');
  const gridScrollTop = container.querySelector('#teacherGridScrollTop');
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
  const actionsTrigger = container.querySelector('#teacherActionsTrigger');
  const actionsMenu = container.querySelector('#teacherActionsMenu');
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

  // Listener click su chip classe
  const classChips = container.querySelectorAll('.class-chip');
  classChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const cls = chip.getAttribute('data-class-name');
      if (onClassClick) onClassClick(cls);
    });
  });

  // Listener Radar
  const radarBtn = container.querySelector('#teacherRadarBtn');
  if (radarBtn) {
    radarBtn.addEventListener('click', () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      if (onRadarClick) onRadarClick(teacher.id);
    });
  }

  // Listener Condividi
  const shareBtn = container.querySelector('#teacherShareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const res = await shareSchedule({
        title: `Orario Docente ${teacher.displayName}`,
        text: `Consulta l'orario scolastico del docente ${teacher.displayName}`,
        type: 'teacher',
        id: teacher.id
      });
      if (res.success && res.method === 'clipboard' && onShowToast) {
        onShowToast(`Link docente ${teacher.displayName} copiato!`, 'success');
      }
    });
  }

  // Listener Copia Testo
  const copyTextBtn = container.querySelector('#teacherCopyTextBtn');
  if (copyTextBtn) {
    copyTextBtn.addEventListener('click', async () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const ok = await copyScheduleAsText({
        title: teacher.displayName,
        type: 'teacher',
        scheduleData: scheduleForTeacher,
        timeSlots: dataset.timeSlots,
        days: dataset.days
      });
      if (ok && onShowToast) {
        onShowToast(`Orario di ${teacher.displayName} copiato!`, 'success');
      }
    });
  }

  // Listener Invia Immagine
  const shareImgBtn = container.querySelector('#teacherShareImgBtn');
  if (shareImgBtn) {
    shareImgBtn.addEventListener('click', async () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const res = await shareScheduleImage({
        title: `Docente ${teacher.displayName}`,
        type: 'teacher',
        scheduleData: scheduleForTeacher,
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
  const exportImgBtn = container.querySelector('#teacherExportImgBtn');
  if (exportImgBtn) {
    exportImgBtn.addEventListener('click', async () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const filename = await exportScheduleAsImage({
        title: `Docente ${teacher.displayName}`,
        type: 'teacher',
        scheduleData: scheduleForTeacher,
        timeSlots: dataset.timeSlots,
        days: dataset.days
      });
      if (filename && onShowToast) {
        onShowToast(`Immagine ${filename} scaricata!`, 'success');
      }
    });
  }

  // Listener Esporta .ICS
  const icsBtn = container.querySelector('#teacherExportIcsBtn');
  if (icsBtn) {
    icsBtn.addEventListener('click', () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      const filename = exportScheduleToIcs({
        title: `Docente_${teacher.displayName.replace(/\s+/g, '_')}`,
        type: 'teacher',
        scheduleData: scheduleForTeacher,
        timeSlots: dataset.timeSlots,
        days: dataset.days
      });
      if (filename && onShowToast) {
        onShowToast(`File ${filename} scaricato!`, 'success');
      }
    });
  }

  // Listener Stampa
  const printBtn = container.querySelector('#teacherPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      window.print();
    });
  }

  // Preferito
  const favBtn = container.querySelector('#teacherFavBtn');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      if (onToggleFavorite) onToggleFavorite('teacher', teacher.id, teacher.displayName);
    });
  }

  // Default
  const defBtn = container.querySelector('#teacherDefaultBtn');
  if (defBtn) {
    defBtn.addEventListener('click', () => {
      if (onSetDefault) onSetDefault('teacher', teacher.id, teacher.displayName);
    });
  }
}

/**
 * Renderizza le schede giornaliere per il docente con fusione delle ore consecutive,
 * rimozione ridondanze, durata formattata ("1 ora", "2 ore") e color-coding.
 */
function renderTeacherDayCards({ timeSlots, daySchedule, isTodayActive, currentSlotIndex, remainingMinutes }) {
  if (!timeSlots || timeSlots.length === 0) {
    return `<div class="state-container"><div class="state-title">Nessuna fascia oraria</div></div>`;
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
              ORA LIBERA ATTUALE ${remainingMinutes ? `(-${remainingMinutes} min)` : ''}
            </div>
          ` : ''}
          <div class="hour-card-header">
            <div class="hour-slot-badge">
              <span class="slot-number">${slot.index}ª ora</span>
              <span class="slot-time">${slot.timeFormatted}</span>
            </div>
          </div>
          <div class="empty-hour-text">Ora libera</div>
        </div>
      `);
      continue;
    }

    // Identifica l'attività principale
    const nonContinuationActs = acts.filter(a => !a.isContinuation);
    const act = nonContinuationActs[0] || acts[0];
    const isDisp = act.isDisposizione;
    const span = Math.max(1, act.durataHours || 1);

    // Calcola l'ora finale in caso di lezione plurioraria
    let endSlot = slot;
    if (span > 1) {
      const targetEndIndex = slot.index + span - 1;
      const foundEnd = timeSlots.find(s => s.index === targetEndIndex);
      if (foundEnd) {
        endSlot = foundEnd;
      }
      for (let s = 1; s < span; s++) {
        skippedSlotIndices.add(slot.index + s);
      }
    }

    const slotLabel = span > 1 ? `${slot.index}ª - ${endSlot.index}ª ora` : `${slot.index}ª ora`;
    const timeLabel = `${slot.startTimeFormatted} - ${endSlot.endTimeFormatted}`;
    const isCurrent = isTodayActive && (currentSlotIndex >= slot.index && currentSlotIndex <= endSlot.index);

    const subjectColor = isDisp ? { color: '#f59e0b' } : getSubjectColor(act.matNome, act.matCod);
    const cleanName = isDisp ? 'Disposizione per sostituzioni' : cleanSubjectName(act.matNome || act.matCod);
    const hasLocation = Boolean(act.aula || (act.sede && act.sede !== 'DISPOSIZIONE'));
    const locationBadges = (!isDisp && hasLocation) ? renderLocationBadge(act.sede, act.aula) : '';
    const coDocenzaBadges = act.isCoDocenza ? renderCoDocenzaBadge(['Co-docente']) : '';
    const hasFooter = Boolean(locationBadges || coDocenzaBadges);

    renderedHtml.push(`
      <div class="hour-card ${isDisp ? 'is-disposizione' : ''} ${isCurrent ? 'current-hour' : ''}" style="border-left: 3px solid ${subjectColor.color};">
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
          ${act.classeShort ? (() => {
            const cInfo = getClassColorInfo(act.classeShort, act.classeFull || '');
            return `
              <span class="class-chip" data-class-name="${act.classeShort}" style="color: ${cInfo.color}; border: 1px solid ${cInfo.color}; background: ${cInfo.bg}; font-weight: 700;" title="Vedi orario classe ${act.classeShort}">
                ${act.classeShort}
              </span>
            `;
          })() : ''}
        </div>

        <div class="hour-card-body">
          <div class="subject-row">
            <div class="subject-name" style="${isDisp ? 'color: var(--badge-disposizione-text); display: flex; align-items: center; gap: 6px;' : ''}">
              ${isDisp ? '<span class="material-symbols-outlined" style="font-size: 18px;">bolt</span>' : ''}
              ${cleanName}
            </div>
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
