/**
 * Modulo Bottom Sheet / Popover Dettaglio Lezione
 * Mostra una scheda ricca con tutti i dettagli dell'ora quando l'utente
 * tocca una cella nella griglia settimanale (fondamentale per la vista Fit to Screen).
 */

import { getIcon } from '../icons.js';
import { getSubjectColor, cleanSubjectName, getClassColorInfo } from '../colors.js';
import { renderLocationBadge, renderCoDocenzaBadge } from './badges.js';

/**
 * Apre il bottom sheet con i dettagli completi della lezione selezionata.
 * @param {Object} options
 * @param {Object} options.act - Attività/lezione selezionata
 * @param {Object} options.slot - Fascia oraria
 * @param {string} options.day - Giorno della settimana
 * @param {number} [options.totalSpan=1] - Durata in ore
 * @param {Function} [options.onTeacherClick] - Callback navigazione docente
 * @param {Function} [options.onClassClick] - Callback navigazione classe
 */
export function openLessonDetailSheet({
  act,
  slot,
  day,
  totalSpan = 1,
  onTeacherClick,
  onClassClick
}) {
  if (!act) return;

  // Rimuovi eventuali sheet già aperti
  document.querySelectorAll('.bottom-sheet-overlay').forEach(el => el.remove());

  const isDisp = Boolean(act.isDisposizione);
  const colorObj = isDisp ? { color: '#b58900' } : getSubjectColor(act.matNome, act.matCod);
  const subjectName = isDisp ? 'Disposizione per sostituzioni' : cleanSubjectName(act.matNome || act.matCod || 'Lezione');
  const teacherName = act.docCogn ? `${act.docCogn}${act.docNome ? ' ' + act.docNome : ''}` : (act.docente || '');
  const classLabel = act.classeFull || act.classeShort || '';
  const dayCapitalized = day ? day.charAt(0).toUpperCase() + day.slice(1) : '';

  const overlay = document.createElement('div');
  overlay.className = 'bottom-sheet-overlay';

  overlay.innerHTML = `
    <div class="bottom-sheet-content" role="dialog" aria-modal="true" aria-labelledby="sheetLessonTitle">
      <div class="bottom-sheet-drag-handle" aria-hidden="true"></div>
      
      <div class="bottom-sheet-header">
        <div class="sheet-title-group">
          <div class="sheet-color-bar" style="background-color: ${colorObj.color};"></div>
          <div>
            <h3 id="sheetLessonTitle" class="sheet-subject-title" style="${isDisp ? 'color: var(--badge-disposizione-text);' : ''}">
              ${isDisp ? getIcon('bolt', { size: 20, style: 'color: var(--badge-disposizione-text);' }) : ''}
              ${subjectName}
            </h3>
            ${(act.matCod && !isDisp && act.matCod !== subjectName) ? `<div class="sheet-subject-sub">${act.matCod}</div>` : ''}
          </div>
        </div>
        <button class="sheet-close-btn" id="sheetCloseBtn" aria-label="Chiudi dettagli">
          ${getIcon('close', { size: 20 })}
        </button>
      </div>

      <div class="bottom-sheet-body">
        <!-- Fascia Oraria e Giorno -->
        <div class="sheet-detail-row">
          <div class="sheet-detail-icon">
            ${getIcon('schedule', { size: 18, style: 'color: var(--accent-primary);' })}
          </div>
          <div class="sheet-detail-info">
            <span class="sheet-detail-label">Orario</span>
            <span class="sheet-detail-value">
              <strong>${dayCapitalized}</strong> • ${slot.index}ª ora 
              <span class="sheet-time-badge">${slot.timeFormatted || (slot.oInizio ? slot.oInizio.replace('h', ':') : '')}</span>
              ${totalSpan > 1 ? `<span class="grid-double-badge" style="margin-left: 6px;">${totalSpan} ore</span>` : ''}
            </span>
          </div>
        </div>

        <!-- Docente (se presente) -->
        ${teacherName ? `
          <div class="sheet-detail-row">
            <div class="sheet-detail-icon">
              ${getIcon('person', { size: 18, style: 'color: var(--accent-primary);' })}
            </div>
            <div class="sheet-detail-info">
              <span class="sheet-detail-label">Docente</span>
              <div class="sheet-actionable-value">
                <span class="sheet-detail-value"><strong>${teacherName}</strong></span>
                ${(onTeacherClick && act.teacherId) ? `
                  <button class="sheet-nav-chip-btn" id="sheetNavTeacherBtn" title="Visualizza orario docente">
                    <span>Vedi orario</span>
                    ${getIcon('menu_book', { size: 14 })}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Classe (se presente) -->
        ${classLabel ? `
          <div class="sheet-detail-row">
            <div class="sheet-detail-icon">
              ${getIcon('school', { size: 18, style: 'color: var(--accent-primary);' })}
            </div>
            <div class="sheet-detail-info">
              <span class="sheet-detail-label">Classe</span>
              <div class="sheet-actionable-value">
                <span class="sheet-detail-value"><strong>${classLabel}</strong></span>
                ${(onClassClick && act.classeShort) ? `
                  <button class="sheet-nav-chip-btn" id="sheetNavClassBtn" title="Visualizza orario classe">
                    <span>Vedi classe</span>
                    ${getIcon('school', { size: 14 })}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Aula e Sede -->
        ${(act.aula || (act.sede && act.sede !== 'DISPOSIZIONE')) ? `
          <div class="sheet-detail-row">
            <div class="sheet-detail-icon">
              ${getIcon('home', { size: 18, style: 'color: var(--accent-primary);' })}
            </div>
            <div class="sheet-detail-info">
              <span class="sheet-detail-label">Luogo</span>
              <div class="sheet-badges-row">
                ${act.aula ? `<span class="badge badge-sede">${act.aula.includes('<') ? act.aula.replace(/[<>]/g, '') : 'Aula ' + act.aula}</span>` : ''}
                ${(act.sede && act.sede !== 'DISPOSIZIONE') ? renderLocationBadge(act.sede, '') : ''}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Eventuale Co-Docenza -->
        ${act.isCoDocenza ? `
          <div class="sheet-detail-row">
            <div class="sheet-detail-icon">
              ${getIcon('swap_horiz', { size: 18, style: 'color: var(--accent-primary);' })}
            </div>
            <div class="sheet-detail-info">
              <span class="sheet-detail-label">Co-Docenza</span>
              <span class="sheet-detail-value">${renderCoDocenzaBadge(true, act.coDocente || '')}</span>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Apertura animata
  requestAnimationFrame(() => {
    overlay.classList.add('open');
  });

  // Chiusura fluida
  let isClosing = false;
  const closeSheet = () => {
    if (isClosing) return;
    isClosing = true;
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.remove();
    }, 220);
  };

  overlay.querySelector('#sheetCloseBtn')?.addEventListener('click', closeSheet);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSheet();
  });

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      closeSheet();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);

  // Navigazione docente
  const navTeacherBtn = overlay.querySelector('#sheetNavTeacherBtn');
  if (navTeacherBtn && onTeacherClick) {
    navTeacherBtn.addEventListener('click', () => {
      closeSheet();
      onTeacherClick(act.teacherId);
    });
  }

  // Navigazione classe
  const navClassBtn = overlay.querySelector('#sheetNavClassBtn');
  if (navClassBtn && onClassClick) {
    navClassBtn.addEventListener('click', () => {
      closeSheet();
      onClassClick(act.classeShort);
    });
  }
}
