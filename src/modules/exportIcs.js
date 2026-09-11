/**
 * Modulo per l'esportazione dell'orario scolastico in formato standard iCalendar (.ics - RFC 5545).
 * Genera eventi con fuso orario Europe/Rome, ricorrenza settimanale fino al termine delle lezioni (10 Giugno 2027)
 * ed esclusione automatica dei periodi di vacanza tramite clausole EXDATE (Calendario Piemonte 2026/2027).
 */

import { SCHOOL_CALENDAR, getExdateListForIcs } from './calendar.js';
import { getIcon } from './icons.js';

// Mappa giorni italiani in offset da lunedì (0 = lunedì, ..., 5 = sabato)
const DAY_OFFSETS = {
  'lunedì': 0,
  'martedì': 1,
  'mercoledì': 2,
  'giovedì': 3,
  'venerdì': 4,
  'sabato': 5
};

/**
 * Trova la data del prossimo giorno specificato a partire da oggi (o lunedì della settimana corrente).
 */
function getNextDateForDay(dayName, baseDate = new Date()) {
  const targetOffset = DAY_OFFSETS[dayName.toLowerCase()] ?? 0;
  const currentDayOfWeek = baseDate.getDay(); // 0 = dom, 1 = lun, ...
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() + distanceToMonday);

  const targetDate = new Date(monday);
  targetDate.setDate(monday.getDate() + targetOffset);
  return targetDate;
}

/**
 * Formatta un oggetto Date e un orario in formato ICS 'YYYYMMDDTHHMMSS'.
 */
function formatIcsDateTime(date, minutesFromMidnight) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');

  return `${y}${m}${d}T${hh}${mm}00`;
}

/**
 * Calcola la data limite UNTIL per la ricorrenza in base all'opzione scelta.
 */
function calculateUntilDate(periodType, baseDate = new Date(), customEndDate = null) {
  if (periodType === 'custom' && customEndDate) {
    const end = new Date(customEndDate);
    const y = end.getFullYear();
    const m = String(end.getMonth() + 1).padStart(2, '0');
    const d = String(end.getDate()).padStart(2, '0');
    return `${y}${m}${d}T235959Z`;
  }

  if (periodType === '4weeks') {
    const end = new Date(baseDate);
    end.setDate(end.getDate() + 28);
    const y = end.getFullYear();
    const m = String(end.getMonth() + 1).padStart(2, '0');
    const d = String(end.getDate()).padStart(2, '0');
    return `${y}${m}${d}T235959Z`;
  }

  // Ufficiale Piemonte da SCHOOL_CALENDAR (o 10 Giugno 2027)
  const endDateStr = SCHOOL_CALENDAR.endDate ? SCHOOL_CALENDAR.endDate.replace(/-/g, '') : '20270610';
  return `${endDateStr}T235959Z`;
}

/**
 * Genera e avvia il download del file .ics per una classe o un docente.
 * @param {object} params - { title, type, scheduleData, timeSlots, days, options }
 */
export function exportScheduleToIcs({
  title,
  type,
  scheduleData,
  timeSlots,
  days,
  options = { period: 'until_end', excludeVacations: true, customStartDate: null, customEndDate: null }
}) {
  if (!scheduleData || !timeSlots) {
    alert('Dati orario non disponibili per l\'esportazione.');
    return;
  }

  const now = new Date();
  const untilDateStr = calculateUntilDate(options.period, now, options.customEndDate);
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const vacationExdates = options.excludeVacations ? getExdateListForIcs() : [];

  // Calcolo data di partenza base
  let startDateBase = now;
  if (options.period === 'full_year') {
    startDateBase = new Date(SCHOOL_CALENDAR.startDate);
  } else if (options.period === 'custom' && options.customStartDate) {
    startDateBase = new Date(options.customStartDate);
  }

  const events = [];

  days.forEach((day) => {
    const daySchedule = scheduleData[day] || {};
    const baseDayDate = getNextDateForDay(day, startDateBase);
    const targetDayOffset = DAY_OFFSETS[day.toLowerCase()] ?? 0;

    timeSlots.forEach((slot) => {
      const acts = daySchedule[slot.index] || [];
      if (acts.length === 0) return;

      acts.forEach((act, actIdx) => {
        if (act.isContinuation) return;

        const durationHours = act.durataHours || 1;
        const startMins = slot.startMinutes;
        const endMins = startMins + (durationHours * 55) + (durationHours > 1 ? (durationHours - 1) * 5 : 0);

        const dtstart = formatIcsDateTime(baseDayDate, startMins);
        const dtend = formatIcsDateTime(baseDayDate, endMins);

        const uid = `orario-${type}-${encodeURIComponent(title)}-${day}-${slot.index}-${actIdx}-${startMins}@orariopellicano`;
        const summary = act.isDisposizione ? 'Disposizione per Sostituzioni' : (act.matNome || act.matCod);
        
        let description = '';
        if (type === 'class') {
          description = `Docente: ${act.teacherDisplayName || 'N/D'}\\nCodice Materia: ${act.matCod}`;
          if (act.isCoDocenza) description += '\\n(Co-Docenza)';
        } else {
          description = act.classeShort ? `Classe: ${act.classeShort} (${act.classeFull})` : 'Disposizione a scuola';
          if (act.isCoDocenza) description += '\\n(In Co-Docenza)';
        }

        const location = [act.aula ? `Aula ${act.aula}` : '', act.sede || 'Sede Centrale'].filter(Boolean).join(', ');

        const eventLines = [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `SUMMARY:${summary.replace(/,/g, '\\,')}`,
          `DESCRIPTION:${description.replace(/,/g, '\\,')}`,
          location ? `LOCATION:${location.replace(/,/g, '\\,')}` : '',
          `DTSTART;TZID=Europe/Rome:${dtstart}`,
          `DTEND;TZID=Europe/Rome:${dtend}`,
          `RRULE:FREQ=WEEKLY;UNTIL=${untilDateStr}`
        ];

        // Se attivata l'esclusione vacanze, inietta le clausole EXDATE per questo giorno della settimana
        if (vacationExdates.length > 0) {
          const hh = String(Math.floor(startMins / 60)).padStart(2, '0');
          const mm = String(startMins % 60).padStart(2, '0');
          vacationExdates.forEach(ymd => {
            const y = parseInt(ymd.substring(0, 4), 10);
            const m = parseInt(ymd.substring(4, 6), 10) - 1;
            const d = parseInt(ymd.substring(6, 8), 10);
            const checkDate = new Date(y, m, d);
            const currentDayOfWeek = checkDate.getDay();
            const normalizedOffset = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
            if (normalizedOffset === targetDayOffset) {
              eventLines.push(`EXDATE;TZID=Europe/Rome:${ymd}T${hh}${mm}00`);
            }
          });
        }

        eventLines.push('STATUS:CONFIRMED');
        eventLines.push('TRANSP:OPAQUE');
        eventLines.push('END:VEVENT');

        events.push(eventLines.filter(Boolean).join('\r\n'));
      });
    });
  });

  if (events.length === 0) {
    alert('Nessuna lezione trovata da esportare.');
    return null;
  }

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Orario Pellicano//Orario Scolastico EDT Piemonte//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Orario ${title}`,
    'X-WR-TIMEZONE:Europe/Rome',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Rome',
    'X-LIC-LOCATION:Europe/Rome',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    events.join('\r\n'),
    'END:VCALENDAR'
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = downloadUrl;
  const safeFilename = `orario-${type}-${title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  return safeFilename;
}

/**
 * Apre il modal di esportazione per consentire la scelta dell'intervallo temporale.
 */
export function openIcsExportModal({ title, type, scheduleData, timeSlots, days, onShowToast }) {
  // Rimuovi eventuali modali aperti
  const existing = document.getElementById('icsExportModal');
  if (existing) existing.remove();

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayYmd = `${y}-${m}-${d}`;
  const endSchoolYmd = SCHOOL_CALENDAR.endDate || '2027-06-10';

  const modal = document.createElement('div');
  modal.id = 'icsExportModal';
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 440px; padding: 22px;">
      <div class="modal-header" style="margin-bottom: 16px;">
        <h3 class="modal-title" style="display: flex; align-items: center; gap: 8px; font-size: 1.1rem;">
          ${getIcon('calendar_month', { size: 22, style: 'color: var(--accent-primary);' })}
          Esporta Calendario (.ics)
        </h3>
        <button class="icon-btn" id="icsModalCloseBtn" aria-label="Chiudi">
          ${getIcon('close', { size: 18 })}
        </button>
      </div>

      <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px;">
        Esporta l'orario di <strong>${title}</strong> per integrarlo in Google Calendar, Apple Calendar o Outlook.
      </div>

      <!-- Lista Opzioni Periodo Custom -->
      <div class="ics-period-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
        <div class="ics-option-card selected" data-value="until_end">
          <div class="ics-custom-radio"></div>
          <span class="ics-option-title">Da oggi a fine lezioni (10 Giu 2027)</span>
        </div>

        <div class="ics-option-card" data-value="4weeks">
          <div class="ics-custom-radio"></div>
          <span class="ics-option-title">Prossime 4 settimane</span>
        </div>

        <div class="ics-option-card" data-value="full_year">
          <div class="ics-custom-radio"></div>
          <span class="ics-option-title">Intero anno scolastico (14 Set – 10 Giu)</span>
        </div>

        <div class="ics-option-card" data-value="custom">
          <div class="ics-custom-radio"></div>
          <span class="ics-option-title">Periodo personalizzato</span>
        </div>
      </div>

      <!-- Sezione Date Personalizzate (Nativa HTML) -->
      <div id="icsCustomDateContainer" class="ics-custom-date-row" style="display: none; margin-bottom: 16px;">
        <div style="flex: 1;">
          <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; display: block;">Data inizio</label>
          <input type="date" id="icsStartDate" value="${todayYmd}" class="input-base" style="width: 100%; font-size: 0.85rem; padding: 7px 10px;">
        </div>
        <div style="flex: 1;">
          <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; display: block;">Data fine</label>
          <input type="date" id="icsEndDate" value="${endSchoolYmd}" class="input-base" style="width: 100%; font-size: 0.85rem; padding: 7px 10px;">
        </div>
      </div>

      <!-- Toggle Esclusione Vacanze con Switch Custom -->
      <div class="ics-vacation-toggle-card" style="margin-bottom: 20px; padding: 12px 14px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary);">
          Escludi automaticamente vacanze e ponti
        </span>
        <label class="custom-toggle-switch" for="icsExcludeVacations" aria-label="Escludi vacanze">
          <input type="checkbox" id="icsExcludeVacations" checked>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button class="btn-secondary" id="icsModalCancelBtn" style="padding: 8px 16px;">Annulla</button>
        <button class="btn-primary" id="icsModalConfirmBtn" style="padding: 8px 20px; display: inline-flex; align-items: center; gap: 6px;">
          ${getIcon('calendar_month', { size: 16 })}
          <span>Scarica .ics</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let selectedPeriod = 'until_end';
  const optionCards = modal.querySelectorAll('.ics-option-card');
  const customDateContainer = modal.querySelector('#icsCustomDateContainer');

  optionCards.forEach(card => {
    card.addEventListener('click', () => {
      optionCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedPeriod = card.getAttribute('data-value');

      if (selectedPeriod === 'custom') {
        customDateContainer.style.display = 'flex';
      } else {
        customDateContainer.style.display = 'none';
      }
    });
  });

  const close = () => modal.remove();
  modal.querySelector('#icsModalCloseBtn').addEventListener('click', close);
  modal.querySelector('#icsModalCancelBtn').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector('#icsModalConfirmBtn').addEventListener('click', () => {
    const excludeVacations = modal.querySelector('#icsExcludeVacations')?.checked ?? true;
    let customStartDate = null;
    let customEndDate = null;

    if (selectedPeriod === 'custom') {
      customStartDate = modal.querySelector('#icsStartDate')?.value;
      customEndDate = modal.querySelector('#icsEndDate')?.value;

      if (!customStartDate || !customEndDate) {
        if (onShowToast) onShowToast('Inserisci sia la data di inizio che di fine.', 'error');
        else alert('Inserisci sia la data di inizio che di fine.');
        return;
      }

      if (customEndDate < customStartDate) {
        if (onShowToast) onShowToast('La data di fine non può precedere la data di inizio.', 'error');
        else alert('La data di fine non può precedere la data di inizio.');
        return;
      }
    }

    close();

    const filename = exportScheduleToIcs({
      title,
      type,
      scheduleData,
      timeSlots,
      days,
      options: {
        period: selectedPeriod,
        excludeVacations,
        customStartDate,
        customEndDate
      }
    });

    if (filename && onShowToast) {
      onShowToast(`File calendario generato: ${filename}`, 'success');
    }
  });
}
