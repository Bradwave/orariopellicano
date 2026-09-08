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

  if (!timeSlots || timeSlots.length === 0) {
    return {
      currentDay,
      currentSlot: null,
      isSchoolHours: false,
      status: 'no_slots'
    };
  }

  const firstSlot = timeSlots[0];
  const lastSlot = timeSlots[timeSlots.length - 1];

  // Prima dell'inizio delle lezioni
  if (currentMinutes < firstSlot.startMinutes) {
    return {
      currentDay,
      currentSlot: null,
      isSchoolHours: false,
      status: 'before_school',
      minutesUntilStart: firstSlot.startMinutes - currentMinutes
    };
  }

  // Dopo la fine delle lezioni
  if (currentMinutes >= lastSlot.endMinutes) {
    return {
      currentDay,
      currentSlot: null,
      isSchoolHours: false,
      status: 'after_school'
    };
  }

  // Verifica all'interno di uno slot di lezione
  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];
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
    if (i < timeSlots.length - 1) {
      const nextSlot = timeSlots[i + 1];
      if (currentMinutes >= slot.endMinutes && currentMinutes < nextSlot.startMinutes) {
        return {
          currentDay,
          currentSlot: null,
          isSchoolHours: true,
          status: 'break',
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
