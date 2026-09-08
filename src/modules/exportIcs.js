/**
 * Modulo per l'esportazione dell'orario scolastico in formato standard iCalendar (.ics - RFC 5545).
 * Genera eventi con fuso orario Europe/Rome e ricorrenza settimanale fino al termine delle lezioni.
 */

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
  // Calcola il lunedì della settimana corrente
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
 * Calcola la data di fine anno scolastico (15 Giugno dell'anno scolastico corrente).
 */
function getSchoolYearEndDate(now = new Date()) {
  const currentYear = now.getFullYear();
  // Se siamo tra settembre e dicembre, la fine dell'anno scolastico è a giugno dell'anno successivo
  const endYear = now.getMonth() >= 7 ? currentYear + 1 : currentYear;
  return `${endYear}0615T235959Z`;
}

/**
 * Genera e avvia il download del file .ics per una classe o un docente.
 * @param {object} params - { title, type: 'class'|'teacher', scheduleData, timeSlots, days }
 */
export function exportScheduleToIcs({ title, type, scheduleData, timeSlots, days }) {
  if (!scheduleData || !timeSlots) {
    alert('Dati orario non disponibili per l\'esportazione.');
    return;
  }

  const now = new Date();
  const untilDateStr = getSchoolYearEndDate(now);
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const events = [];

  days.forEach((day) => {
    const daySchedule = scheduleData[day] || {};
    const baseDayDate = getNextDateForDay(day, now);

    timeSlots.forEach((slot) => {
      const acts = daySchedule[slot.index] || [];
      if (acts.length === 0) return;

      acts.forEach((act, actIdx) => {
        // Evita duplicazione per ore continuative se già calcolata la durata
        if (act.isContinuation) return;

        const durationHours = act.durataHours || 1;
        const startMins = slot.startMinutes;
        const endMins = startMins + (durationHours * 55) + (durationHours > 1 ? (durationHours - 1) * 5 : 0);

        const dtstart = formatIcsDateTime(baseDayDate, startMins);
        const dtend = formatIcsDateTime(baseDayDate, endMins);

        const uid = `orario-${type}-${encodeURIComponent(title)}-${day}-${slot.index}-${actIdx}-${startMins}@orariopellicano`;
        const summary = act.isDisposizione ? '⚡ Disposizione per Sostituzioni' : (act.matNome || act.matCod);
        
        let description = '';
        if (type === 'class') {
          description = `Docente: ${act.teacherDisplayName || 'N/D'}\\nCodice Materia: ${act.matCod}`;
          if (act.isCoDocenza) description += '\\n(Co-Docenza)';
        } else {
          description = act.classeShort ? `Classe: ${act.classeShort} (${act.classeFull})` : 'Disposizione a scuola';
          if (act.isCoDocenza) description += '\\n(In Co-Docenza)';
        }

        const location = [act.aula ? `Aula ${act.aula}` : '', act.sede || 'Sede Centrale'].filter(Boolean).join(', ');

        events.push([
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `SUMMARY:${summary.replace(/,/g, '\\,')}`,
          `DESCRIPTION:${description.replace(/,/g, '\\,')}`,
          location ? `LOCATION:${location.replace(/,/g, '\\,')}` : '',
          `DTSTART;TZID=Europe/Rome:${dtstart}`,
          `DTEND;TZID=Europe/Rome:${dtend}`,
          `RRULE:FREQ=WEEKLY;UNTIL=${untilDateStr}`,
          'STATUS:CONFIRMED',
          'TRANSP:OPAQUE',
          'END:VEVENT'
        ].filter(Boolean).join('\r\n'));
      });
    });
  });

  if (events.length === 0) {
    alert('Nessuna lezione trovata da esportare.');
    return;
  }

  // File iCalendar completo con definizione TimeZone Europe/Rome
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Orario Pellicano//Orario Scolastico EDT//IT',
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
