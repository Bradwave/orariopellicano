/**
 * Calendario Scolastico Regione Piemonte 2026/2027
 * Include date ufficiali di inizio, termine e sospensione delle lezioni.
 */

// Configurazione predefinita (utilizzata come fallback immediato e sincrono)
export let SCHOOL_CALENDAR = {
  year: '2026/2027',
  region: 'Piemonte',
  startDate: '2026-09-14',
  endDate: '2027-06-10',
  singleHolidays: [
    { date: '2026-10-04', name: 'San Francesco (Festa Nazionale)' },
    { date: '2026-11-01', name: 'Tutti i Santi' },
    { date: '2026-12-07', name: 'Ponte Immacolata (Sospensione lezioni)' },
    { date: '2026-12-08', name: 'Immacolata Concezione' },
    { date: '2027-04-25', name: 'Festa della Liberazione' },
    { date: '2027-05-01', name: 'Festa del Lavoro' },
    { date: '2027-06-02', name: 'Festa della Repubblica' }
  ],
  vacationRanges: [
    {
      name: 'Vacanze di Natale',
      start: '2026-12-23',
      end: '2027-01-06'
    },
    {
      name: 'Vacanze di Carnevale',
      start: '2027-02-06',
      end: '2027-02-10'
    },
    {
      name: 'Vacanze di Pasqua',
      start: '2027-03-25',
      end: '2027-03-30'
    }
  ]
};

/**
 * Tenta di caricare la configurazione dinamica da src/config/calendar.json.
 */
export async function initCalendarConfig() {
  try {
    const res = await fetch('./src/config/calendar.json');
    if (res.ok) {
      const data = await res.json();
      SCHOOL_CALENDAR = data;
    }
  } catch (e) {
    // Mantieni configurazione predefinita in caso di offline iniziale
  }
}

// Avvia il caricamento in background
initCalendarConfig();

/**
 * Formatta una data nel formato YYYY-MM-DD locale.
 */
export function formatDateToYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Verifica se una data specifica è giorno di vacanza o sospensione lezioni.
 * @param {Date} [date=new Date()]
 * @returns {{ isHoliday: boolean, name: string|null }}
 */
export function getHolidayOrVacation(date = new Date()) {
  const ymd = formatDateToYMD(date);

  // 1. Controllo singole festività
  const single = SCHOOL_CALENDAR.singleHolidays?.find(h => h.date === ymd);
  if (single) {
    return { isHoliday: true, name: single.name };
  }

  // 2. Controllo intervalli di vacanza
  if (SCHOOL_CALENDAR.vacationRanges) {
    for (const range of SCHOOL_CALENDAR.vacationRanges) {
      if (ymd >= range.start && ymd <= range.end) {
        return { isHoliday: true, name: range.name };
      }
    }
  }

  // 3. Prima dell'inizio o dopo il termine dell'anno scolastico
  if (ymd < SCHOOL_CALENDAR.startDate) {
    return { isHoliday: true, name: 'Anno scolastico non iniziato' };
  }
  if (ymd > SCHOOL_CALENDAR.endDate) {
    return { isHoliday: true, name: 'Lezioni concluse per l\'anno scolastico' };
  }

  return { isHoliday: false, name: null };
}

/**
 * Genera l'elenco di tutte le date di vacanza in formato YYYYMMDD per le direttive EXDATE di iCalendar (.ics).
 * Esclude domeniche per mantenere compatto il payload.
 * @returns {string[]} Date nel formato 'YYYYMMDD'
 */
export function getExdateListForIcs() {
  const exdates = [];

  // Helper per iterare tra due date
  function addRange(startStr, endStr) {
    const curr = new Date(startStr);
    const end = new Date(endStr);
    while (curr <= end) {
      // Escludi domeniche (day 0) perché l'orario scolastico copre Lun-Sab
      if (curr.getDay() !== 0) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        exdates.push(`${y}${m}${d}`);
      }
      curr.setDate(curr.getDate() + 1);
    }
  }

  // Singole festività
  SCHOOL_CALENDAR.singleHolidays.forEach(h => {
    const d = new Date(h.date);
    if (d.getDay() !== 0) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      exdates.push(`${y}${m}${day}`);
    }
  });

  // Range di vacanze
  SCHOOL_CALENDAR.vacationRanges.forEach(r => {
    addRange(r.start, r.end);
  });

  // Rimuovi duplicati e ordina
  return Array.from(new Set(exdates)).sort();
}
