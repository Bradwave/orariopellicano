/**
 * Modulo Bottom Sheet / Popover Dettaglio Lezione
 * Mostra una scheda ricca con tutti i dettagli dell'ora quando l'utente
 * tocca una cella nella griglia settimanale (fondamentale per la vista Fit to Screen).
 */

import { getIcon } from '../icons.js';
import { getSubjectColor, cleanSubjectName, getClassColorInfo } from '../colors.js';
import { renderLocationBadge, renderCoDocenzaBadge } from './badges.js';
import { getClassroomInfo } from '../classrooms.js';
import { formatClassDisplayName } from '../parser.js';

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
  const colorObj = isDisp ? { color: '#fbbf24' } : getSubjectColor(act.matNome, act.matCod);
  const subjectName = isDisp ? 'Disposizione per sostituzioni' : cleanSubjectName(act.matNome || act.matCod || 'Lezione');
  const teacherName = act.docCogn ? `${act.docCogn}${act.docNome ? ' ' + act.docNome : ''}` : (act.docente || '');
  const teacherUpper = teacherName ? teacherName.toUpperCase() : '';
  const classLabel = act.classeDisplayShort || formatClassDisplayName(act.classeShort) || act.classeFull || act.classeShort || '';
  const dayCapitalized = day ? day.charAt(0).toUpperCase() + day.slice(1) : '';
  const slotNum = `${slot.index || slot.ora || 1}ª ora`;
  const timeFormatted = slot.timeFormatted || (slot.oInizio ? `${slot.oInizio.replace('h', ':')} – ${slot.oFine ? slot.oFine.replace('h', ':') : ''}` : '');

  // Info classe & color-coding indirizzo
  const classColorInfo = getClassColorInfo(act.classeShort || classLabel, act.classeFull || '');
  const trackColor = classColorInfo ? classColorInfo.color : 'var(--accent-primary)';
  const trackName = classColorInfo ? classColorInfo.trackName : '';

  // Info aula e dislocazione
  const classroom = getClassroomInfo(act.classeShort || act.classeFull || classLabel);
  const isGym = Boolean(act.matNome && /motori|sport|ed\.?\s*fis|palestra/i.test(act.matNome)) || Boolean(act.aula && /palestra/i.test(act.aula));

  let roomBadge = '';
  if (isGym) {
    roomBadge = 'Palestra';
  } else if (classroom && classroom.aula) {
    roomBadge = `Aula ${classroom.aula}`;
  } else if (act.aula) {
    const rawAula = act.aula.includes('<') ? act.aula.replace(/[<>]/g, '') : act.aula;
    roomBadge = rawAula.toLowerCase().startsWith('aula') ? rawAula : `Aula ${rawAula}`;
  } else if (act.sede && act.sede !== 'DISPOSIZIONE') {
    roomBadge = act.sede;
  } else {
    roomBadge = isDisp ? 'Palazzina Uffici' : 'Aula non assegnata';
  }

  const rawWing = (classroom && classroom.ala) || (act.sede && act.sede !== 'DISPOSIZIONE' ? act.sede : '');
  const cleanWing = rawWing ? rawWing.replace(/^Ala\s+/i, '').trim() : '';
  const roomFloor = (classroom && classroom.piano)
    ? (classroom.piano.includes('piano') || classroom.piano.includes('scient') ? classroom.piano : `${classroom.piano} Piano`)
    : '';

  const roomMetaText = [
    roomFloor,
    (cleanWing && cleanWing.toLowerCase() !== roomBadge.toLowerCase() ? cleanWing : '')
  ].filter(Boolean).join(' • ');

  const roomIconClass = isGym ? '' : (classroom ? classroom.wingClass : '');
  const roomIconStyle = isGym
    ? 'color: var(--badge-palestra-text, #34d399);'
    : (isDisp
        ? 'color: var(--badge-disposizione-text, #fbbf24);'
        : (classroom ? 'color: var(--wing-color, var(--accent-primary));' : 'color: var(--text-secondary);'));

  const overlay = document.createElement('div');
  overlay.className = 'bottom-sheet-overlay';

  overlay.innerHTML = `
    <div class="bottom-sheet-content" role="dialog" aria-modal="true" aria-labelledby="sheetLessonTitle">
      <div class="bottom-sheet-drag-handle" aria-hidden="true"></div>
      
      <div class="sheet-container-6d">
        <!-- 1. Header orario con icona allineata e font 6C/6D -->
        <div class="sheet-aligned-row-6d">
          <div class="sheet-icon-6d" style="color: var(--text-muted);">
            ${getIcon('schedule', { size: 18 })}
          </div>
          <div class="sheet-info-col-6d sheet-text-pad-6d">
            <div class="sheet-time-top-6d">
              <span class="sheet-day-slot-6d">${dayCapitalized} • ${slotNum}</span>
              <button class="sheet-close-btn-6d" id="sheetCloseBtn" aria-label="Chiudi dettagli">
                ${getIcon('close', { size: 16 })}
              </button>
            </div>
            <span class="sheet-time-sub-6d">${timeFormatted} ${totalSpan > 1 ? `(${totalSpan} ore)` : ''}</span>
          </div>
        </div>

        <!-- Divisore orizzontale -->
        <div class="sheet-divider-rule-6d"></div>

        <!-- 2. Materia con icona color-coded -->
        <div class="sheet-aligned-row-6d">
          <div class="sheet-icon-6d" style="color: ${colorObj.color};">
            ${isDisp ? getIcon('bolt', { size: 19 }) : getIcon('menu_book', { size: 19 })}
          </div>
          <div class="sheet-info-col-6d sheet-text-pad-6d">
            <span id="sheetLessonTitle" class="sheet-subject-title-6d" style="${isDisp ? 'color: var(--badge-disposizione-text);' : ''}">
              ${subjectName}
            </span>
          </div>
        </div>

        <!-- Divisore orizzontale che separa la materia da quello che segue (solo se c'è qualcosa che segue) -->
        ${(teacherName || classLabel || (!isDisp && roomBadge)) ? `
          <div class="sheet-divider-rule-6d"></div>
        ` : ''}

        <!-- 3. Docente con icona color-coded e tag cliccabile a lato -->
        ${teacherName ? `
          <div class="sheet-aligned-row-6d" style="align-items: center;">
            <div class="sheet-icon-6d" style="color: var(--accent-primary);">
              ${getIcon('person', { size: 16 })}
            </div>
            <div class="sheet-info-col-6d">
              ${(onTeacherClick && (act.teacherId || act.docId)) ? `
                <button class="sheet-tag-6d" id="sheetNavTeacherBtn" title="Visualizza orario di ${teacherUpper}">
                  <span>${teacherUpper}</span>
                  ${act.isCoDocenza ? `<span class="sheet-tag-sub-6d">• co-docenza</span>` : ''}
                </button>
              ` : `
                <div class="sheet-tag-6d">
                  <span>${teacherUpper}</span>
                  ${act.isCoDocenza ? `<span class="sheet-tag-sub-6d">• co-docenza</span>` : ''}
                </div>
              `}
            </div>
          </div>
        ` : ''}

        <!-- 4. Classe con icona color-coded (trackColor) e tag cliccabile a lato -->
        ${classLabel ? `
          <div class="sheet-aligned-row-6d" style="align-items: center;">
            <div class="sheet-icon-6d" style="color: ${trackColor};">
              ${getIcon('school', { size: 16 })}
            </div>
            <div class="sheet-info-col-6d">
              ${(onClassClick && act.classeShort) ? `
                <button class="sheet-tag-6d" id="sheetNavClassBtn" title="Visualizza orario della classe ${classLabel}">
                  <span>${classLabel}</span>
                  ${trackName ? `<span class="sheet-tag-sub-6d">• ${trackName}</span>` : ''}
                </button>
              ` : `
                <div class="sheet-tag-6d">
                  <span>${classLabel}</span>
                  ${trackName ? `<span class="sheet-tag-sub-6d">• ${trackName}</span>` : ''}
                </div>
              `}
            </div>
          </div>
        ` : ''}

        <!-- 5. Spazio / Aula con icona color-coded e testo semplice su due righe (senza "Ala", omessa se a disposizione) -->
        ${(!isDisp && roomBadge) ? `
          <div class="sheet-aligned-row-6d">
            <div class="sheet-icon-6d ${roomIconClass}" style="${roomIconStyle}">
              ${isGym ? getIcon('fitness_center', { size: 17 }) : getIcon('meeting_room', { size: 17 })}
            </div>
            <div class="sheet-info-col-6d sheet-text-pad-6d" style="gap: 2px;">
              <span class="sheet-room-name-6d">${roomBadge}</span>
              ${roomMetaText ? `<span class="sheet-room-sub-6d">${roomMetaText}</span>` : ''}
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
      onTeacherClick(act.teacherId || act.docId);
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
