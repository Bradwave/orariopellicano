/**
 * Vista Orario per Classe:
 * - Toggle fluido tra List View giornaliera e Weekly Grid View
 * - Esportazione iCalendar (.ics)
 * - Condivisione nativa (Web Share API)
 * - Layout di Stampa A4 tipografico
 */

import { renderLocationBadge, renderCoDocenzaBadge } from './badges.js';
import { getCurrentScheduleState, getCurrentDayName } from '../time.js';
import { exportScheduleToIcs } from '../exportIcs.js';
import { shareSchedule } from '../share.js';

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

  container.innerHTML = `
    <!-- Intestazione visibile ESCLUSIVAMENTE in fase di STAMPA (@media print) -->
    <div class="print-only-header">
      <div class="print-school-title">Liceo Statale • Orario delle Lezioni</div>
      <div class="print-meta">
        <span><strong>ORARIO CLASSE: ${classObj.full} (${classObj.short})</strong></span>
        <span>Generato il: ${new Date().toLocaleDateString('it-IT')} ore ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <!-- Active Entity Banner -->
    <div class="active-view-banner">
      <div class="banner-entity-info">
        <span class="banner-type-badge">Orario Classe</span>
        <h1 class="banner-entity-name">${classObj.short}</h1>
        <span style="font-size: 0.8rem; color: var(--text-muted);">${classObj.full}</span>
      </div>
      
      <div class="banner-actions">
        <button id="classFavBtn" class="star-fav-btn ${isFavorite ? 'favorited' : ''}" title="Salva nei preferiti">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          ${isFavorite ? 'Salvato' : 'Salva'}
        </button>
        <button id="classDefaultBtn" class="star-fav-btn ${isDefault ? 'favorited' : ''}" title="Imposta come vista predefinita all'avvio">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${isDefault ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          ${isDefault ? 'Predefinito' : 'Predefinisci'}
        </button>
      </div>
    </div>

    <!-- View Mode Toggle Bar (Lista vs Settimana) & Azioni Esportazione/Stampa -->
    <div class="view-toggle-bar">
      <div class="view-mode-selector">
        <button class="view-mode-btn ${viewMode === 'list' ? 'active' : ''}" id="modeListBtn" title="Visualizzazione a schede per giorno (mobile)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
          Lista
        </button>
        <button class="view-mode-btn ${viewMode === 'weekly' ? 'active' : ''}" id="modeWeeklyBtn" title="Visualizzazione a griglia settimanale completa">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
          Settimana
        </button>
      </div>

      <div class="view-actions-right">
        <button class="action-chip-btn" id="classShareBtn" title="Condividi orario con link diretto">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
          Condividi
        </button>
        <button class="action-chip-btn" id="classExportIcsBtn" title="Esporta calendario in formato .ics (Apple Calendar, Google, Outlook)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          .ICS
        </button>
        <button class="action-chip-btn" id="classPrintBtn" title="Stampa orario su foglio A4 o salva come PDF">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
          Stampa
        </button>
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
                <span class="day-indicator"></span>
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

    <!-- 2. Desktop & Full Weekly CSS Grid (Mostrata se viewMode === 'weekly' oppure in stampa) -->
    <div class="weekly-grid-container ${viewMode === 'weekly' ? 'desktop-active' : ''}" id="classWeeklyGrid" style="${viewMode === 'weekly' ? 'display: block;' : ''}">
      <div class="weekly-grid">
        <div class="grid-header-cell">Ora / Giorno</div>
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
              rowHtml += `<div class="grid-content-cell" style="opacity: 0.35; justify-content: center; align-items: center;"><span style="font-size: 0.72rem; color: var(--text-muted);">-</span></div>`;
            } else {
              const act = dayActs[0];
              rowHtml += `
                <div class="grid-content-cell ${isCurrentCell ? 'current-cell' : ''}">
                  <div class="grid-subject">${act.matNome || act.matCod}</div>
                  <div class="grid-subtext">${act.docCogn ? act.docCogn + (act.docNome ? ' ' + act.docNome : '') : ''}</div>
                  <div class="badges-group" style="margin-top: 4px;">
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

  // Listener Esporta .ICS
  const icsBtn = container.querySelector('#classExportIcsBtn');
  if (icsBtn) {
    icsBtn.addEventListener('click', () => {
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

function renderDayCards({ timeSlots, daySchedule, isTodayActive, currentSlotIndex, remainingMinutes }) {
  if (!timeSlots || timeSlots.length === 0) {
    return `<div class="state-container"><div class="state-title">Nessuna fascia oraria disponibile</div></div>`;
  }

  return timeSlots.map(slot => {
    const acts = daySchedule[slot.index] || [];
    const isCurrent = isTodayActive && (slot.index === currentSlotIndex);

    if (acts.length === 0) {
      return `
        <div class="hour-card empty-hour ${isCurrent ? 'current-hour' : ''}">
          ${isCurrent ? `
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
      `;
    }

    const mainAct = acts[0];
    const teachersList = acts.map(a => a.teacherDisplayName).filter(Boolean);
    const isMultipleTeachers = teachersList.length > 1;

    return `
      <div class="hour-card ${isCurrent ? 'current-hour' : ''}">
        ${isCurrent ? `
          <div class="current-hour-pill">
            <span class="pulse-dot-live"></span>
            IN CORSO ${remainingMinutes ? `(-${remainingMinutes} min)` : ''}
          </div>
        ` : ''}
        
        <div class="hour-card-header">
          <div class="hour-slot-badge">
            <span class="slot-number">${slot.index}ª ora</span>
            <span class="slot-time">${slot.timeFormatted}</span>
          </div>
          <div class="slot-duration">${mainAct.durata}</div>
        </div>

        <div class="hour-card-body">
          <div class="subject-name">${mainAct.matNome || mainAct.matCod}</div>
          <div class="subject-code">${mainAct.matCod}</div>
        </div>

        <div class="hour-card-footer">
          <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
            ${acts.map(a => a.teacherId ? `
              <span class="teacher-chip" data-teacher-id="${a.teacherId}" title="Apri orario docente">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${a.teacherDisplayName}
              </span>
            ` : '').join('')}
          </div>

          <div class="badges-group">
            ${isMultipleTeachers || mainAct.isCoDocenza ? renderCoDocenzaBadge(teachersList) : ''}
            ${renderLocationBadge(mainAct.sede, mainAct.aula)}
          </div>
        </div>
      </div>
    `;
  }).join('');
}
