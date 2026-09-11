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
import { getSubjectColor, cleanSubjectName, formatDurationLabel, getClassColor, getClassColorInfo } from '../colors.js';

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
        <span class="banner-meta-chip">
          ${totalHours} ore (${disposizioniCount} a disp.)
        </span>
      </div>
      
      <div class="banner-actions">
        <button id="teacherFavBtn" class="icon-action-btn ${isFavorite ? 'favorited' : ''}" title="${isFavorite ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}" aria-label="Preferito">
          <span class="material-symbols-outlined" style="font-size: 19px;">${isFavorite ? 'star' : 'star_outline'}</span>
        </button>
        <button id="teacherDefaultBtn" class="icon-action-btn ${isDefault ? 'default-active' : ''}" title="${isDefault ? 'Vista predefinita attiva' : 'Imposta come vista predefinita all\'avvio'}" aria-label="Predefinito">
          <span class="material-symbols-outlined" style="font-size: 18px;">push_pin</span>
        </button>
      </div>
    </div>

    <!-- View Mode Toggle Bar (Lista vs Settimana) & Menu Azioni Compatto -->
    <div class="view-toggle-bar">
      <div class="view-mode-selector">
        <button class="view-mode-btn ${viewMode === 'list' ? 'active' : ''}" id="modeListBtn" title="Visualizzazione lista per giorno">
          <span class="material-symbols-outlined" style="font-size: 16px;">view_agenda</span>
          Lista
        </button>
        <button class="view-mode-btn ${viewMode === 'weekly' ? 'active' : ''}" id="modeWeeklyBtn" title="Visualizzazione griglia settimanale">
          <span class="material-symbols-outlined" style="font-size: 16px;">calendar_view_week</span>
          Settimana
        </button>
      </div>

      <div class="actions-dropdown-container">
        <button class="action-chip-btn" id="teacherActionsTrigger" title="Altre azioni" aria-haspopup="true" aria-expanded="false">
          <span class="material-symbols-outlined" style="font-size: 16px;">more_horiz</span>
          Azioni
        </button>
        <div class="actions-dropdown-menu" id="teacherActionsMenu" hidden>
          <button class="dropdown-item-btn" id="teacherRadarBtn" style="color: #34d399;">
            <span class="material-symbols-outlined" style="color: #34d399;">radar</span>
            <span>Radar Colleghi</span>
          </button>
          <button class="dropdown-item-btn" id="teacherShareBtn">
            <span class="material-symbols-outlined">share</span>
            <span>Condividi link</span>
          </button>
          <button class="dropdown-item-btn" id="teacherExportIcsBtn">
            <span class="material-symbols-outlined">calendar_month</span>
            <span>Esporta .ICS</span>
          </button>
          <button class="dropdown-item-btn" id="teacherPrintBtn">
            <span class="material-symbols-outlined">print</span>
            <span>Stampa / PDF</span>
          </button>
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
                <span class="day-indicator"></span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 1. Mobile-First Card Schedule List (Mostrata solo se viewMode === 'list') -->
    ${viewMode === 'list' ? `
      <div class="schedule-list">
        ${renderTeacherDayCards({
          timeSlots: dataset.timeSlots,
          daySchedule: scheduleForTeacher[currentDay] || {},
          isTodayActive,
          currentSlotIndex: timeState.currentSlotIndex,
          remainingMinutes: timeState.remainingMinutes
        })}
      </div>
    ` : ''}

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
              const colorObj = isDisp ? { color: '#d97706' } : getSubjectColor(act.matNome, act.matCod);
              const cleanName = isDisp ? 'Disposizione' : cleanSubjectName(act.matNome || act.matCod);
              const classInfo = act.classeShort ? getClassColorInfo(act.classeShort, act.classeFull || '') : null;
              const classLabel = act.classeShort || (isDisp ? 'A Disposizione' : '');
              const classColor = classInfo ? classInfo.color : 'var(--text-secondary)';
              rowHtml += `
                <div class="grid-content-cell ${isCurrentCell ? 'current-cell' : ''}" style="border-left: 3px solid ${colorObj.color};">
                  <div class="grid-cell-top">
                    <div class="grid-subject" title="${cleanName}" style="${isDisp ? 'color: var(--badge-disposizione-text); font-weight: 700;' : ''}">${cleanName}</div>
                    <div class="grid-subtext" title="${classLabel}" style="color: ${classColor}; font-weight: 700;">${classLabel}</div>
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
  `;

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
          <div class="empty-hour-text">Nessun impegno scolastico (Ora Libera)</div>
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
    const cleanName = isDisp ? 'Disposizione per Sostituzioni' : cleanSubjectName(act.matNome || act.matCod);
    const durationLabel = formatDurationLabel(act.durata, span);

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
          <div class="slot-duration">${durationLabel}</div>
        </div>

        <div class="hour-card-body">
          <div class="subject-name" style="${isDisp ? 'color: var(--badge-disposizione-text); display: flex; align-items: center; gap: 6px;' : ''}">
            ${isDisp ? '<span class="material-symbols-outlined" style="font-size: 18px;">bolt</span>' : ''}
            ${cleanName}
          </div>
        </div>

        <div class="hour-card-footer">
          <div>
            ${act.classeShort ? (() => {
              const cInfo = getClassColorInfo(act.classeShort, act.classeFull || '');
              return `
                <span class="class-chip" data-class-name="${act.classeShort}" style="color: ${cInfo.color}; border: 1px solid ${cInfo.color}; background: ${cInfo.bg}; font-weight: 700;" title="Vedi orario classe ${act.classeShort}">
                  <span class="material-symbols-outlined" style="font-size: 14px;">school</span>
                  Classe ${act.classeShort}
                </span>
              `;
            })() : (isDisp ? '<span class="badge badge-disposizione">A Disposizione</span>' : '')}
          </div>

          <div class="badges-group">
            ${act.isCoDocenza ? renderCoDocenzaBadge(['Co-docente']) : ''}
            ${renderLocationBadge(act.sede, act.aula)}
          </div>
        </div>
      </div>
    `);
  }

  return renderedHtml.join('');
}
