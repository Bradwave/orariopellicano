/**
 * Modulo per il calcolo del tempo reale, individuazione dell'ora corrente
 * e Time Highlighting nella visualizzazione dell'orario scolastico.
 */

const ITALIAN_DAYS = [
  'domenica',
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato'
];

/**
 * Restituisce il giorno della settimana corrente in italiano minuscolo.
 */
export function getCurrentDayName(date = new Date()) {
  return ITALIAN_DAYS[date.getDay()];
}

/**
 * Restituisce i minuti trascorsi dalla mezzanotte per una data.
 */
export function getMinutesFromMidnight(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export const SCHOOL_BREAKS = [
  {
    id: 1,
    name: '1° Intervallo',
    label: '09:50 - 10:00',
    startTimeFormatted: '09:50',
    endTimeFormatted: '10:00',
    startMinutes: 590, // 09:50
    endMinutes: 600,   // 10:00
    afterSlotIndex: 2,
    appliesToSaturday: true
  },
  {
    id: 2,
    name: '2° Intervallo',
    label: '11:50 - 12:00',
    startTimeFormatted: '11:50',
    endTimeFormatted: '12:00',
    startMinutes: 710, // 11:50
    endMinutes: 720,   // 12:00
    afterSlotIndex: 4,
    appliesToSaturday: false // Sabato c'è solo il 1° intervallo
  }
];

/**
 * Verifica se per un dato giorno esiste un intervallo dopo il dato slot orario.
 */
export function getBreakAfterSlot(dayName, slotIndex) {
  const normalizedDay = (dayName || '').toLowerCase();
  return SCHOOL_BREAKS.find(b => {
    if (b.afterSlotIndex !== slotIndex) return false;
    if (normalizedDay === 'sabato' && !b.appliesToSaturday) return false;
    return true;
  }) || null;
}

/**
 * Restituisce i dettagli sull'intervallo corrente, tenendo conto della regola del sabato.
 */
export function getCurrentBreakInfo(now = new Date()) {
  const dayName = getCurrentDayName(now);
  const minutes = getMinutesFromMidnight(now);

  for (const b of SCHOOL_BREAKS) {
    if (dayName === 'sabato' && !b.appliesToSaturday) continue;
    if (minutes >= b.startMinutes && minutes < b.endMinutes) {
      return {
        isBreak: true,
        breakObj: b,
        name: b.name,
        remainingMinutes: b.endMinutes - minutes,
        endTime: b.endTimeFormatted
      };
    }
  }

  return { isBreak: false, breakObj: null };
}

/**
 * Restituisce le informazioni orarie calibrate per un determinato giorno della settimana.
 * Al sabato la 5ª ora inizia alle 11:50 e termina alle 12:45 (assenza del 2° intervallo).
 */
export function getSlotTimesForDay(slot, dayName = '') {
  if (!slot) return null;
  const isSaturday = (dayName || '').toLowerCase() === 'sabato';

  if (isSaturday && slot.index === 5) {
    return {
      ...slot,
      startMinutes: 710, // 11:50
      endMinutes: 765,   // 12:45
      startTimeFormatted: '11:50',
      endTimeFormatted: '12:45',
      timeFormatted: '11:50 - 12:45'
    };
  }

  return slot;
}

/**
 * Valuta lo stato dell'orario scolastico per il giorno e ora correnti.
 * @param {Array} timeSlots - Elenco degli slot estratti dal parser
 * @param {Date} simulatedDate - Data opzionale (utile per test o orario reale)
 * @returns {object} Informazioni sullo slot corrente
 */
export function getCurrentScheduleState(timeSlots = [], simulatedDate = null) {
  const now = simulatedDate || new Date();
  const currentDay = getCurrentDayName(now);
  const currentMinutes = getMinutesFromMidnight(now);
  const isSaturday = currentDay === 'sabato';

  if (!timeSlots || timeSlots.length === 0) {
    return {
      currentDay,
      currentSlot: null,
      isSchoolHours: false,
      status: 'no_slots'
    };
  }

  // Costruisci gli slot calibrati per il giorno (es. sabato 5ª ora 11:50-12:45)
  const effectiveSlots = timeSlots
    .filter(s => !isSaturday || s.index <= 5)
    .map(s => getSlotTimesForDay(s, currentDay));

  const firstSlot = effectiveSlots[0];
  const lastSlot = effectiveSlots[effectiveSlots.length - 1];

  // Prima dell'inizio delle lezioni
  if (currentMinutes < firstSlot.startMinutes) {
    const minutesUntilStart = firstSlot.startMinutes - currentMinutes;
    return {
      currentDay,
      currentSlot: null,
      isSchoolHours: false,
      status: 'before_school',
      minutesUntilStart,
      remainingMinutes: minutesUntilStart
    };
  }

  // Dopo la fine delle lezioni (al sabato ore 12:45)
  if (currentMinutes >= lastSlot.endMinutes) {
    return {
      currentDay,
      currentSlot: null,
      isSchoolHours: false,
      status: 'after_school'
    };
  }

  // Verifica all'interno di uno slot di lezione
  for (let i = 0; i < effectiveSlots.length; i++) {
    const slot = effectiveSlots[i];
    if (currentMinutes >= slot.startMinutes && currentMinutes < slot.endMinutes) {
      const remainingMinutes = slot.endMinutes - currentMinutes;
      return {
        currentDay,
        currentSlot: slot,
        currentSlotIndex: slot.index,
        isSchoolHours: true,
        status: 'in_progress',
        remainingMinutes
      };
    }

    // Intervallo tra due lezioni (es. Ricreazione o cambio d'ora)
    if (i < effectiveSlots.length - 1) {
      const nextSlot = effectiveSlots[i + 1];
      if (currentMinutes >= slot.endMinutes && currentMinutes < nextSlot.startMinutes) {
        const breakInfo = getCurrentBreakInfo(now);
        return {
          currentDay,
          currentSlot: null,
          isSchoolHours: true,
          status: 'break',
          isOfficialBreak: breakInfo.isBreak,
          breakName: breakInfo.name || 'Intervallo / Cambio d\'ora',
          nextSlot: nextSlot,
          remainingMinutes: nextSlot.startMinutes - currentMinutes
        };
      }
    }
  }

  return {
    currentDay,
    currentSlot: null,
    isSchoolHours: false,
    status: 'outside'
  };
}

/**
 * Avvia un watcher periodico che notifica ogni 30 secondi il cambio minuto per aggiornare l'ora attiva.
 */
export function startTimeWatcher(callback) {
  // Esegui subito una volta
  callback();
  const intervalId = setInterval(callback, 30000);
  return () => clearInterval(intervalId);
}
