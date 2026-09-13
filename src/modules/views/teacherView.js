/**
 * Vista Orario per Docente:
 * - Toggle fluido tra List View giornaliera e Weekly Grid View
 * - Fusione compatta delle lezioni di 2 ore (o pluriorarie) in singola scheda
 * - Gestione ore a DISPOSIZIONE e co-docenze
 * - Color coding universale per materia / classe
 * - Menu azioni compatto [ ⋯ Azioni ] con Radar colleghi, .ICS, condivisione e stampa
 */

import { renderLocationBadge, renderCoDocenzaBadge } from './badges.js';
import { getCurrentScheduleState, getCurrentDayName, getBreakAfterSlot, getSlotTimesForDay } from '../time.js';
import { openIcsExportModal } from '../exportIcs.js';
import { shareSchedule } from '../share.js';
import { copyScheduleAsText, exportScheduleAsImage, shareScheduleImage } from '../exportManager.js';
import { getSubjectColor, cleanSubjectName, formatDurationLabel, getClassColor, getClassColorInfo, getGridSubjectName, getUltraCompactSubjectName } from '../colors.js';
import { getIcon } from '../icons.js';
import { openLessonDetailSheet } from './lessonDetailSheet.js';
import { getClassroomInfo } from '../classrooms.js';
import { formatClassDisplayName } from '../parser.js';
import { getShowTeacherRoomPreference } from '../storage.js';

const DAY_SHORT_MAP = {
  lunedi: 'Lun',
  lunedì: 'Lun',
  martedi: 'Mar',
  martedì: 'Mar',
  mercoledi: 'Mer',
  mercoledì: 'Mer',
  giovedi: 'Gio',
  giovedì: 'Gio',
  venerdi: 'Ven',
  venerdì: 'Ven',
  sabato: 'Sab',
  domenica: 'Dom'
};

export function renderTeacherView({
  container,
  dataset,
  teacherId,
  activeDay,
  viewMode = 'list', // 'list' | 'weekly'
  isWeeklyFit = false,
  isFavorite = false,
  isDefault = false,
  onDayChange,
  onViewModeChange,
  onWeeklyFitToggle,
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
      <div class="print-school-title">Liceo Statale Pellico-Peano • Orario Docenti</div>
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
          ${getIcon(isFavorite ? 'star' : 'star_outline', { size: 19 })}
        </button>
        <button id="teacherDefaultBtn" class="icon-action-btn ${isDefault ? 'default-active' : ''}" title="${isDefault ? 'Vista predefinita attiva' : 'Imposta come vista predefinita all\'avvio'}" aria-label="Predefinito">
          ${getIcon('push_pin', { size: 18 })}
        </button>
        <div class="actions-dropdown-container">
          <button class="icon-action-btn" id="teacherActionsTrigger" title="Altre azioni" aria-haspopup="true" aria-expanded="false" aria-label="Altre azioni">
            ${getIcon('more_horiz', { size: 20 })}
          </button>
          <div class="actions-dropdown-menu" id="teacherActionsMenu" hidden>
            <div class="actions-dropdown-header">
              <div class="dropdown-header-stat">
                ${getIcon('schedule', { size: 16, style: 'color: var(--accent-primary);' })}
                <span><strong>${totalHours}</strong> ore</span>
              </div>
              ${disposizioniCount > 0 ? `
                <div class="dropdown-header-stat" style="color: var(--badge-disposizione-text);">
                  ${getIcon('bolt', { size: 16 })}
                  <span><strong>${disposizioniCount}</strong> a disposizione</span>
                </div>
              ` : ''}
            </div>
            <div class="actions-dropdown-divider"></div>
            <button class="dropdown-item-btn" id="teacherRadarBtn" style="color: var(--accent-primary);">
              ${getIcon('radar', { size: 18, style: 'color: var(--accent-primary);' })}
              <span>Radar colleghi</span>
            </button>
            <div class="actions-dropdown-divider"></div>
            <div class="dropdown-section-label">Condividi</div>
            <button class="dropdown-item-btn" id="teacherShareImgBtn">
              ${getIcon('send', { size: 18 })}
              <span>Invia immagine</span>
            </button>
            <button class="dropdown-item-btn" id="teacherCopyTextBtn">
              ${getIcon('content_copy', { size: 18 })}
              <span>Copia orario</span>
            </button>
            <button class="dropdown-item-btn" id="teacherShareBtn">
              ${getIcon('share', { size: 18 })}
              <span>Condividi link</span>
            </button>
            <div class="actions-dropdown-divider"></div>
            <div class="dropdown-section-label">Esporta</div>
            <div class="export-buttons-row">
              <button class="export-compact-btn" id="teacherExportImgBtn" title="Scarica immagine PNG" aria-label="Scarica immagine">
                ${getIcon('image', { size: 18 })}
              </button>
              <button class="export-compact-btn" id="teacherPrintBtn" title="Stampa o salva come PDF" aria-label="Stampa o salva come PDF">
                ${getIcon('print', { size: 18 })}
              </button>
              <button class="export-compact-btn" id="teacherExportIcsBtn" title="Esporta calendario (.ics)" aria-label="Esporta calendario .ics">
                ${getIcon('calendar_month', { size: 18 })}
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
      <div class="schedule-list" id="teacherScheduleList">
        ${renderTeacherDayCards({
          currentDay,
          timeSlots: dataset.timeSlots,
          daySchedule: scheduleForTeacher[currentDay] || {},
          isTodayActive,
          currentSlotIndex: timeState.currentSlotIndex,
          remainingMinutes: timeState.remainingMinutes,
          timeState
        })}
      </div>
    ` : ''}

    <!-- Top Horizontal Scrollbar per Griglia Settimanale -->
    <div class="grid-scrollbar-top ${viewMode === 'weekly' ? 'visible' : ''} ${isWeeklyFit ? 'hidden-fit' : ''}" id="teacherGridScrollTop">
      <div class="grid-scrollbar-track"></div>
    </div>

    <!-- 2. Desktop & Full Weekly CSS Grid (Mostrata se viewMode === 'weekly' oppure in stampa) -->
    <div class="weekly-grid-container ${viewMode === 'weekly' ? 'desktop-active' : ''} ${isWeeklyFit ? 'fit-screen' : ''}" id="teacherWeeklyGrid" style="${viewMode === 'weekly' ? 'display: block;' : ''}">
      <div class="weekly-grid teacher-grid ${isWeeklyFit ? 'fit-screen' : ''}">
        <div class="grid-header-cell empty-corner" aria-hidden="true"></div>
        ${dataset.days.map(d => `
          <div class="grid-header-cell ${d === realCurrentDay ? 'is-today' : ''}">${DAY_SHORT_MAP[d.toLowerCase()] || d.substring(0, 3)}</div>
        `).join('')}

        ${(() => {
          const mergedGridSlots = new Set();
          return dataset.timeSlots.map(slot => {
            let rowHtml = `
              <div class="grid-time-cell">
                <strong>${slot.index}ª ora</strong>
                <span>${slot.oInizio.replace('h', ':')}</span>
              </div>
            `;
            dataset.days.forEach(d => {
              // Se questa cella è già stata assorbita dall'ora precedente, non emettere nulla
              if (mergedGridSlots.has(`${d}-${slot.index}`)) {
                return;
              }

              const dayActs = (scheduleForTeacher[d] && scheduleForTeacher[d][slot.index]) || [];
              const isCurrentCell = (d === realCurrentDay && slot.index === timeState.currentSlotIndex);
              if (dayActs.length === 0) {
                rowHtml += `<div class="grid-content-cell empty-cell"></div>`;
              } else {
                const act = dayActs[0];
                const isDisp = act.isDisposizione;
                const colorObj = isDisp ? { color: '#b58900' } : getSubjectColor(act.matNome, act.matCod);
                const cleanName = isDisp ? 'Disposizione' : cleanSubjectName(act.matNome || act.matCod);
                const gridSubName = isDisp 
                  ? (isWeeklyFit ? 'Disp' : 'Disposizione') 
                  : (isWeeklyFit ? getUltraCompactSubjectName(act.matNome, act.matCod) : getGridSubjectName(act.matNome, act.matCod));
                const classInfo = (!isDisp && act.classeShort) ? getClassColorInfo(act.classeShort, act.classeFull || '') : null;
                const classLabel = isDisp ? '' : (act.classeDisplayShort || formatClassDisplayName(act.classeShort) || act.classeShort || '');
                const classColor = classInfo ? classInfo.color : 'var(--text-muted)';

                // Controlla fusione con ora successiva se NON c'è intervallo intermedio
                let canMergeWithNext = false;
                if (!getBreakAfterSlot(d, slot.index)) {
                  const nextSlotActs = (scheduleForTeacher[d] && scheduleForTeacher[d][slot.index + 1]) || [];
                  const nextAct = nextSlotActs[0];
                  if (nextAct && 
                      !isDisp && !nextAct.isDisposizione &&
                      nextAct.matCod === act.matCod && 
                      nextAct.classeShort === act.classeShort && 
                      nextAct.aula === act.aula) {
                    canMergeWithNext = true;
                    mergedGridSlots.add(`${d}-${slot.index + 1}`);
                  }
                }

                const roomInfo = !isDisp ? getClassroomInfo(act.classeShort) : null;
                const roomDisplay = roomInfo ? `<span class="badge badge-classroom-grid ${roomInfo.wingClass}" title="${roomInfo.fullText}">A.${roomInfo.aula}</span>` : '';

                rowHtml += `
                  <div class="grid-content-cell ${canMergeWithNext ? 'span-double-hour' : ''} ${isCurrentCell ? 'current-cell' : ''}" 
                       style="border-left: 3px solid ${colorObj.color}; ${canMergeWithNext ? 'grid-row: span 2;' : ''}"
                       data-day="${d}" data-slot="${slot.index}" data-span="${canMergeWithNext ? 2 : 1}">
                    <div class="grid-cell-top">
                      <div class="grid-subject" title="${cleanName}" style="${isDisp ? 'color: var(--badge-disposizione-text); font-weight: 700;' : ''}">
                        ${gridSubName}
                      </div>
                      ${classLabel ? `<div class="grid-subtext" title="${classLabel}" style="color: ${classColor}; font-weight: 600;">${classLabel}</div>` : ''}
                    </div>
                    <div class="grid-cell-bottom">
                      ${roomDisplay}
                      ${(!isDisp && act.aula && (!roomInfo || act.aula !== roomInfo.aula)) ? `<span class="badge badge-sede">${act.aula.includes('<') ? act.aula.replace(/[<>]/g, '') : 'Aula ' + act.aula}</span>` : ''}
                      ${(!isDisp && act.sede && act.sede !== 'DISPOSIZIONE') ? renderLocationBadge(act.sede, '') : ''}
                    </div>
                  </div>
                `;
              }
            });

            // Inserimento 1° Intervallo (dopo 2ª ora, Lunedì–Sabato)
            if (slot.index === 2) {
              if (isWeeklyFit) {
                rowHtml += `
                  <div class="grid-break-banner-cell is-fit-full" style="grid-column: 1 / span ${dataset.days.length + 1};">
                    ${getIcon('coffee', { size: 14 })} 1° intervallo
                  </div>
                `;
              } else {
                rowHtml += `
                  <div class="grid-break-time-cell">
                    <strong>09:50</strong>
                    <span>10:00</span>
                  </div>
                  <div class="grid-break-banner-cell" style="grid-column: 2 / span ${dataset.days.length};">
                    ${getIcon('coffee', { size: 14 })} 1° intervallo
                  </div>
                `;
              }
            }

            // Inserimento 2° Intervallo (dopo 4ª ora, Lunedì–Venerdì; al Sabato la 5ª ora parte alle 11:50)
            if (slot.index === 4) {
              const hasSaturday = dataset.days.includes('sabato');
              const weekdaysCount = hasSaturday ? dataset.days.length - 1 : dataset.days.length;

              let sat5Html = '';
              if (hasSaturday) {
                mergedGridSlots.add('sabato-5');
                const satActs = (scheduleForTeacher['sabato'] && scheduleForTeacher['sabato'][5]) || [];
                const isSatCurrent = (realCurrentDay === 'sabato' && timeState.currentSlotIndex === 5);
                if (satActs.length === 0) {
                  sat5Html = `<div class="grid-content-cell empty-cell grid-cell-saturday-slot5" style="grid-column: ${weekdaysCount + 2}; grid-row: span 2;"></div>`;
                } else {
                  const act = satActs[0];
                  const isDisp = act.isDisposizione;
                  const colorObj = isDisp ? { color: '#f59e0b' } : (act.classeShort ? getClassColorInfo(act.classeShort) : getSubjectColor(act.matNome, act.matCod));
                  const cleanName = isDisp ? 'Disposizione' : cleanSubjectName(act.matNome || act.matCod);
                  const gridSubName = isDisp
                    ? (isWeeklyFit ? 'Disp' : 'Disposizione')
                    : (isWeeklyFit ? getUltraCompactSubjectName(act.matNome, act.matCod) : getGridSubjectName(act.matNome, act.matCod));
                  const classLabel = isDisp ? '' : formatClassDisplayName(act.classeShort);

                  sat5Html = `
                    <div class="grid-content-cell grid-cell-saturday-slot5 ${isSatCurrent ? 'current-cell' : ''}" 
                         style="border-left: 3px solid ${colorObj.color}; grid-column: ${weekdaysCount + 2}; grid-row: span 2;"
                         data-day="sabato" data-slot="5" data-span="1"
                         title="${cleanName} • 11:50 – 12:45">
                      <div class="grid-cell-top">
                        <div class="grid-subject" title="${cleanName}" style="${isDisp ? 'color: var(--badge-disposizione-text); font-weight: 700;' : ''}">
                          ${gridSubName}
                        </div>
                        ${classLabel ? `<div class="grid-subtext" title="Classe ${classLabel}">${classLabel}</div>` : ''}
                      </div>
                      <div class="grid-cell-bottom">
                        ${act.aula ? `<span class="badge badge-sede">${act.aula.includes('<') ? act.aula.replace(/[<>]/g, '') : 'Aula ' + act.aula}</span>` : ''}
                        ${renderLocationBadge(act.sede, '')}
                      </div>
                    </div>
                  `;
                }
              }

              if (isWeeklyFit) {
                rowHtml += `
                  <div class="grid-break-banner-cell is-fit-full" style="grid-column: 1 / span ${weekdaysCount + 1};">
                    ${getIcon('coffee', { size: 14 })} 2° intervallo
                  </div>
                  ${sat5Html}
                `;
              } else {
                rowHtml += `
                  <div class="grid-break-time-cell">
                    <strong>11:50</strong>
                    <span>12:00</span>
                  </div>
                  <div class="grid-break-banner-cell" style="grid-column: 2 / span ${weekdaysCount};">
                    ${getIcon('coffee', { size: 14 })} 2° intervallo
                  </div>
                  ${sat5Html}
                `;
              }
            }

            return rowHtml;
          }).join('');
        })()}
      </div>
    </div>

    <!-- Floating View Mode Toggle (Centrato sopra la bottom nav) -->
    <div class="floating-view-toggle">
      <div class="view-mode-selector floating">
        <button class="view-mode-btn ${viewMode === 'list' ? 'active' : ''}" id="modeListBtn" title="Visualizzazione lista per giorno">
          ${getIcon('calendar_today', { size: 16 })}
          Lista
        </button>
        <button class="view-mode-btn ${viewMode === 'weekly' ? 'active' : ''}" id="modeWeeklyBtn" title="Visualizzazione griglia settimanale">
          ${getIcon('calendar_month', { size: 16 })}
          Settimana
        </button>
        <div class="view-mode-divider"></div>
        <button class="view-mode-btn icon-only-btn ${isWeeklyFit && viewMode === 'weekly' ? 'active' : ''}" id="teacherWeeklyFitBtn" ${viewMode === 'list' ? 'disabled' : ''} title="${isWeeklyFit ? 'Ripristina larghezza standard' : 'Adatta allo schermo'}" aria-label="${isWeeklyFit ? 'Ripristina larghezza standard' : 'Adatta allo schermo'}">
          ${getIcon(isWeeklyFit && viewMode === 'weekly' ? 'fullscreen_exit' : 'fullscreen', { size: 18 })}
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

  // Listener Toggle Adatta allo Schermo (Fit to Screen)
  const weeklyFitBtn = container.querySelector('#teacherWeeklyFitBtn');
  if (weeklyFitBtn) {
    weeklyFitBtn.addEventListener('click', () => {
      if (onWeeklyFitToggle) onWeeklyFitToggle();
    });
  }

  // Listener click su celle griglia per dettaglio lezione (bottom sheet)
  const gridCells = container.querySelectorAll('.weekly-grid .grid-content-cell:not(.empty-cell)');
  gridCells.forEach(cell => {
    cell.addEventListener('click', () => {
      const cellDay = cell.getAttribute('data-day');
      const cellSlotIdx = parseInt(cell.getAttribute('data-slot'), 10);
      const cellSpan = parseInt(cell.getAttribute('data-span'), 10) || 1;
      const dayActs = (scheduleForTeacher[cellDay] && scheduleForTeacher[cellDay][cellSlotIdx]) || [];
      const targetAct = dayActs[0];
      const targetSlot = dataset.timeSlots.find(s => s.index === cellSlotIdx) || { index: cellSlotIdx, oInizio: '', timeFormatted: '' };
      if (targetAct) {
        openLessonDetailSheet({
          act: targetAct,
          slot: targetSlot,
          day: cellDay,
          totalSpan: cellSpan,
          onClassClick
        });
      }
    });
  });

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

  // Listener click su card lista per dettaglio lezione (bottom sheet)
  const listCards = container.querySelectorAll('.schedule-list .hour-card:not(.empty-hour)');
  listCards.forEach(card => {
    const handleCardClick = (e) => {
      // Se cliccato su chip classe, lascia agire il suo listener
      if (e.target.closest('.class-chip')) return;
      const cardDay = card.getAttribute('data-day') || currentDay;
      const cardSlotIdx = parseInt(card.getAttribute('data-slot'), 10);
      const cardSpan = parseInt(card.getAttribute('data-span'), 10) || 1;
      const dayActs = (scheduleForTeacher[cardDay] && scheduleForTeacher[cardDay][cardSlotIdx]) || [];
      const targetAct = dayActs[0];
      const targetSlot = dataset.timeSlots.find(s => s.index === cardSlotIdx) || { index: cardSlotIdx, oInizio: '', timeFormatted: '' };
      if (targetAct) {
        openLessonDetailSheet({
          act: targetAct,
          slot: targetSlot,
          day: cardDay,
          totalSpan: cardSpan,
          onClassClick
        });
      }
    };
    card.addEventListener('click', handleCardClick);
    const row = card.closest('.timeline-row');
    if (row) {
      const timeCol = row.querySelector('.timeline-time-col');
      if (timeCol) {
        timeCol.style.cursor = 'pointer';
        timeCol.addEventListener('click', handleCardClick);
      }
    }
  });

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
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
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

  // Listener Esporta .ICS con Modal di selezione periodo ed esclusione vacanze
  const icsBtn = container.querySelector('#teacherExportIcsBtn');
  if (icsBtn) {
    icsBtn.addEventListener('click', () => {
      if (actionsMenu) actionsMenu.setAttribute('hidden', '');
      openIcsExportModal({
        title: `Docente ${teacher.displayName}`,
        type: 'teacher',
        scheduleData: scheduleForTeacher,
        timeSlots: dataset.timeSlots,
        days: dataset.days,
        onShowToast
      });
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
 * rimozione ridondanze, durata formattata ("1 ora", "2 ore") e divisori per intervalli.
 */
function renderTeacherDayCards({ currentDay, timeSlots, daySchedule, isTodayActive, currentSlotIndex, remainingMinutes, timeState }) {
  if (!timeSlots || timeSlots.length === 0) {
    return `<div class="state-container"><div class="state-title">Nessuna fascia oraria</div></div>`;
  }

  const renderedHtml = [];
  const skippedSlotIndices = new Set();

  for (let i = 0; i < timeSlots.length; i++) {
    const rawSlot = timeSlots[i];
    if (currentDay.toLowerCase() === 'sabato' && rawSlot.index > 5) {
      continue;
    }
    const slot = getSlotTimesForDay(rawSlot, currentDay);
    if (skippedSlotIndices.has(slot.index)) {
      continue;
    }

    const acts = daySchedule[slot.index] || [];
    const isCurrentDirect = isTodayActive && (slot.index === currentSlotIndex);

    if (acts.length === 0) {
      renderedHtml.push(`
        <div class="timeline-row">
          <div class="timeline-time-col ${isCurrentDirect ? 'is-current' : ''}">
            <div class="timeline-slot-num">${slot.index}ª ora</div>
            <div class="timeline-slot-hours">${slot.startTimeFormatted}<br>${slot.endTimeFormatted}</div>
            ${isCurrentDirect && remainingMinutes ? `
              <div class="timeline-live-tag-col" title="Tempo rimanente">
                -${remainingMinutes} min
              </div>
            ` : ''}
          </div>
          <div class="hour-card timeline-card empty-hour ${isCurrentDirect ? 'current-hour' : ''}">
            <div class="empty-hour-text" style="${isCurrentDirect ? 'color: var(--accent-primary); font-weight: 600;' : ''}">
              ${isCurrentDirect ? 'Ora libera attuale' : 'Ora libera'}
            </div>
          </div>
        </div>
      `);

      // Divisore intervallo dopo ora libera
      const breakObj = getBreakAfterSlot(currentDay, slot.index);
      if (breakObj) {
        const isBreakCurrent = isTodayActive && timeState && timeState.status === 'break' && (timeState.breakName === breakObj.name || (timeState.breakObj && timeState.breakObj.id === breakObj.id));
        const breakRemainingMinutes = isBreakCurrent ? timeState.remainingMinutes : null;

        renderedHtml.push(`
          <div class="timeline-break ${isBreakCurrent ? 'is-current' : ''}">
            <div class="timeline-break-time">
              <span>${breakObj.startTimeFormatted}<br>${breakObj.endTimeFormatted}</span>
              ${isBreakCurrent && breakRemainingMinutes ? `
                <div class="timeline-live-tag-col" style="margin-top: 3px;" title="Tempo rimanente all'intervallo">
                  -${breakRemainingMinutes} min
                </div>
              ` : ''}
            </div>
            <div class="timeline-break-body">
              ${getIcon('coffee', { size: 15 })}
              <span>${breakObj.name}</span>
            </div>
          </div>
        `);
      }
      continue;
    }

    // Identifica l'attività principale
    const nonContinuationActs = acts.filter(a => !a.isContinuation);
    const act = nonContinuationActs[0] || acts[0];
    const isDisp = act.isDisposizione;

    // Calcolo span: se c'è un intervallo subito dopo questo slot, non fondere oltre
    let span = 1;
    const hasBreakAfterCurrent = Boolean(getBreakAfterSlot(currentDay, slot.index));

    if (!hasBreakAfterCurrent) {
      const rawSpan = Math.max(1, act.durataHours || 1);
      if (rawSpan > 1) {
        let canSpan = true;
        for (let offset = 0; offset < rawSpan - 1; offset++) {
          if (getBreakAfterSlot(currentDay, slot.index + offset)) {
            canSpan = false;
            break;
          }
        }
        if (canSpan) span = rawSpan;
      }

      if (span === 1 && !isDisp) {
        const nextActs = daySchedule[slot.index + 1] || [];
        const nextAct = nextActs.find(a => !a.isContinuation) || nextActs[0];
        if (nextAct && 
            !nextAct.isDisposizione &&
            nextAct.matCod === act.matCod && 
            nextAct.classeShort === act.classeShort &&
            nextAct.aula === act.aula) {
          span = 2;
        }
      }
    }

    const rawEndSlot = timeSlots.find(s => s.index === slot.index + span - 1) || rawSlot;
    const endSlot = getSlotTimesForDay(rawEndSlot, currentDay);

    if (span > 1) {
      for (let s = 1; s < span; s++) {
        skippedSlotIndices.add(slot.index + s);
      }
    }

    const slotLabel = span > 1 ? `${slot.index}ª - ${endSlot.index}ª ora` : `${slot.index}ª ora`;
    const slotTimeFormatted = `${slot.startTimeFormatted}<br>${endSlot.endTimeFormatted}`;
    const isCurrent = isTodayActive && (currentSlotIndex >= slot.index && currentSlotIndex <= endSlot.index);

    const subjectColor = isDisp ? { color: '#f59e0b' } : getSubjectColor(act.matNome, act.matCod);
    const cleanName = isDisp ? 'Disposizione per sostituzioni' : cleanSubjectName(act.matNome || act.matCod);
    const showRoomPref = getShowTeacherRoomPreference();
    const roomInfo = (!isDisp && act.classeShort) ? getClassroomInfo(act.classeShort) : null;
    const classroomBadge = (showRoomPref && roomInfo) ? `<span class="badge badge-classroom ${roomInfo.wingClass}" title="${roomInfo.fullLocation}">${getIcon('meeting_room', { size: 12, style: 'margin-right: 3px;' })}Aula ${roomInfo.aula} • ${roomInfo.piano} p.</span>` : '';
    const hasLocation = Boolean(act.aula || (act.sede && act.sede !== 'DISPOSIZIONE'));
    const locationBadges = (!isDisp && hasLocation && (!roomInfo || act.aula !== roomInfo.aula)) ? renderLocationBadge(act.sede, act.aula) : ((!isDisp && act.sede && act.sede !== 'DISPOSIZIONE') ? renderLocationBadge(act.sede, '') : '');
    const coDocenzaBadges = act.isCoDocenza ? renderCoDocenzaBadge(['Co-docente']) : '';

    renderedHtml.push(`
      <div class="timeline-row">
        <div class="timeline-time-col ${isCurrent ? 'is-current' : ''}">
          <div class="timeline-slot-num">${slotLabel}</div>
          <div class="timeline-slot-hours">${slotTimeFormatted}</div>
          ${isCurrent && remainingMinutes ? `
            <div class="timeline-live-tag-col" title="Tempo rimanente al termine dell'ora">
              -${remainingMinutes} min
            </div>
          ` : ''}
        </div>

        <div class="hour-card timeline-card is-interactive ${isDisp ? 'is-disposizione' : ''} ${isCurrent ? 'current-hour' : ''}" 
             data-day="${currentDay}" 
             data-slot="${slot.index}" 
             data-span="${span}" 
             style="border-left: 3px solid ${subjectColor.color}; cursor: pointer;">
          
          <div class="timeline-card-top">
            <span class="timeline-subject" style="${isDisp ? 'color: var(--badge-disposizione-text); display: flex; align-items: center; gap: 6px;' : ''}">
              ${isDisp ? getIcon('bolt', { size: 16, style: 'color: var(--badge-disposizione-text, #b58900);' }) : ''}
              ${cleanName}
            </span>
          </div>

          <div class="timeline-card-bottom">
            ${act.classeShort ? (() => {
              const cInfo = getClassColorInfo(act.classeShort, act.classeFull || '');
              const displayCls = act.classeDisplayShort || formatClassDisplayName(act.classeShort) || act.classeShort;
              return `
                <span class="class-chip" data-class-name="${act.classeShort}" style="color: ${cInfo.color}; border: 1px solid ${cInfo.color}; background: ${cInfo.bg}; font-weight: 700;" title="Vedi orario classe ${displayCls}">
                  ${displayCls}
                </span>
              `;
            })() : ''}
            ${classroomBadge}
            ${coDocenzaBadges}
            ${locationBadges}
          </div>
        </div>
      </div>
    `);

    // Inserimento divisore intervallo dopo la fine della lezione
    const breakObj = getBreakAfterSlot(currentDay, endSlot.index);
    if (breakObj) {
      const isBreakCurrent = isTodayActive && timeState && timeState.status === 'break' && (timeState.breakName === breakObj.name || (timeState.breakObj && timeState.breakObj.id === breakObj.id));
      const breakRemainingMinutes = isBreakCurrent ? timeState.remainingMinutes : null;

      renderedHtml.push(`
        <div class="timeline-break ${isBreakCurrent ? 'is-current' : ''}">
          <div class="timeline-break-time">
            <span>${breakObj.startTimeFormatted}<br>${breakObj.endTimeFormatted}</span>
            ${isBreakCurrent && breakRemainingMinutes ? `
              <div class="timeline-live-tag-col" style="margin-top: 3px;" title="Tempo rimanente all'intervallo">
                -${breakRemainingMinutes} min
              </div>
            ` : ''}
          </div>
          <div class="timeline-break-body">
            ${getIcon('coffee', { size: 15 })}
            <span>${breakObj.name}</span>
          </div>
        </div>
      `);
    }
  }

  return renderedHtml.join('');
}
