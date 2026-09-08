/**
 * Modulo Radar Colleghi (Live Tracker Docenti).
 * Calcola in tempo reale la posizione e lo stato di servizio di un docente
 * incrociando l'orario di sistema con le fasce orarie e l'albero delle attività.
 */

import { getCurrentDayName, getMinutesFromMidnight } from './time.js';

/**
 * Calcola la posizione e lo stato attuale in tempo reale di un docente.
 * @param {object} dataset - Dataset parsed EDT
 * @param {string} teacherId - ID del docente (DOC_COGN DOC_NOME)
 * @param {Date} [customDate=null] - Data opzionale per testing o orario reale
 * @returns {object} Stato in tempo reale del docente
 */
export function getTeacherLiveStatus(dataset, teacherId, customDate = null) {
  const now = customDate || new Date();
  const currentDay = getCurrentDayName(now);
  const currentMinutes = getMinutesFromMidnight(now);

  const teacher = dataset.teachers.find(t => t.id === teacherId) || { id: teacherId, displayName: teacherId };
  const scheduleForTeacher = dataset.byTeacher[teacherId] || {};
  const dayActivities = scheduleForTeacher[currentDay] || {};

  // Se è domenica o giorno senza lezioni
  if (currentDay === 'domenica') {
    return {
      teacher,
      currentDay,
      statusCode: 'weekend',
      badgeClass: 'status-offline',
      title: 'Domenica',
      description: 'Scuola chiusa (Giorno festivo)',
      subtext: 'Nessuna attività programmata per oggi'
    };
  }

  const timeSlots = dataset.timeSlots || [];
  if (timeSlots.length === 0) {
    return {
      teacher,
      currentDay,
      statusCode: 'no_slots',
      badgeClass: 'status-offline',
      title: 'Dati orario non disponibili',
      description: 'Nessuna fascia oraria configurata'
    };
  }

  const firstSlot = timeSlots[0];
  const lastSlot = timeSlots[timeSlots.length - 1];

  // Raccogli tutte le lezioni del docente per oggi
  const allTodayLessons = [];
  timeSlots.forEach(s => {
    const acts = dayActivities[s.index] || [];
    acts.forEach(a => {
      allTodayLessons.push({ slot: s, act: a });
    });
  });

  if (allTodayLessons.length === 0) {
    return {
      teacher,
      currentDay,
      statusCode: 'day_off',
      badgeClass: 'status-neutral',
      title: 'Giorno Libero',
      description: 'Non a scuola (Nessuna lezione in programma oggi)',
      subtext: 'Il docente non ha ore assegnate in questo giorno'
    };
  }

  // Prima dell'inizio della giornata scolastica
  if (currentMinutes < firstSlot.startMinutes) {
    const nextFirst = allTodayLessons[0];
    const minsToStart = nextFirst.slot.startMinutes - currentMinutes;
    return {
      teacher,
      currentDay,
      statusCode: 'before_school',
      badgeClass: 'status-pending',
      title: 'Prima delle lezioni',
      description: `Inizio previsto alle ${nextFirst.slot.startTimeFormatted}`,
      subtext: nextFirst.act.isDisposizione
        ? 'Prima ora a DISPOSIZIONE'
        : `1ª lezione: ${nextFirst.act.matNome || nextFirst.act.matCod} in Classe ${nextFirst.act.classeShort}`,
      remainingMinutes: minsToStart
    };
  }

  // Dopo la fine della giornata scolastica
  if (currentMinutes >= lastSlot.endMinutes) {
    return {
      teacher,
      currentDay,
      statusCode: 'after_school',
      badgeClass: 'status-offline',
      title: 'Lezioni Concluse',
      description: 'Non a scuola (Lezioni per oggi terminate)',
      subtext: 'Tutte le attività della giornata sono state completate'
    };
  }

  // Verifica all'interno degli slot orari
  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];

    // Se siamo all'interno della fascia oraria di lezione
    if (currentMinutes >= slot.startMinutes && currentMinutes < slot.endMinutes) {
      const remainingMinutes = slot.endMinutes - currentMinutes;
      const actsInSlot = dayActivities[slot.index] || [];

      if (actsInSlot.length > 0) {
        const currentAct = actsInSlot[0];

        if (currentAct.isDisposizione) {
          return {
            teacher,
            currentDay,
            slot,
            statusCode: 'disposizione',
            badgeClass: 'status-disposizione',
            title: 'Ora a DISPOSIZIONE',
            description: `Attualmente a disposizione per sostituzioni (Sede: ${currentAct.sede || 'Centrale'})`,
            subtext: `Termina tra ${remainingMinutes} minuti (alle ${slot.endTimeFormatted})`,
            classe: null,
            aula: currentAct.aula || 'Disposizione',
            sede: currentAct.sede || 'Sede Centrale',
            remainingMinutes
          };
        } else {
          return {
            teacher,
            currentDay,
            slot,
            statusCode: 'in_service',
            badgeClass: 'status-active',
            title: 'In Servizio (Lezione in corso)',
            description: `Attualmente in servizio nella classe ${currentAct.classeShort || currentAct.classeFull}${currentAct.aula ? ', aula ' + currentAct.aula : ''}`,
            subtext: `Materia: ${currentAct.matNome || currentAct.matCod} • Termina tra ${remainingMinutes} minuti (alle ${slot.endTimeFormatted})`,
            classe: currentAct.classeShort,
            classeFull: currentAct.classeFull,
            materia: currentAct.matNome || currentAct.matCod,
            aula: currentAct.aula,
            sede: currentAct.sede,
            isCoDocenza: currentAct.isCoDocenza,
            remainingMinutes
          };
        }
      } else {
        // Ora buca
        return {
          teacher,
          currentDay,
          slot,
          statusCode: 'free_hour',
          badgeClass: 'status-neutral',
          title: 'Ora Buca / Libera',
          description: `Nessuna lezione durante la ${slot.index}ª ora (${slot.timeFormatted})`,
          subtext: `Rientro tra ${remainingMinutes} minuti`,
          remainingMinutes
        };
      }
    }

    // Intervallo / Ricreazione tra due ore
    if (i < timeSlots.length - 1) {
      const nextSlot = timeSlots[i + 1];
      if (currentMinutes >= slot.endMinutes && currentMinutes < nextSlot.startMinutes) {
        const remainingMinutes = nextSlot.startMinutes - currentMinutes;
        const nextActs = dayActivities[nextSlot.index] || [];
        const nextAct = nextActs[0];

        return {
          teacher,
          currentDay,
          statusCode: 'break',
          badgeClass: 'status-break',
          title: 'Intervallo / Cambio d\'ora',
          description: `Pausa fino alle ${nextSlot.startTimeFormatted} (tra ${remainingMinutes} min)`,
          subtext: nextAct 
            ? `Prossima ora: ${nextAct.isDisposizione ? 'Disposizione' : (nextAct.matNome || nextAct.matCod)} in Classe ${nextAct.classeShort}`
            : 'Prossima ora: Libera',
          remainingMinutes
        };
      }
    }
  }

  return {
    teacher,
    currentDay,
    statusCode: 'unknown',
    badgeClass: 'status-offline',
    title: 'Stato non determinabile',
    description: 'Fuori orario scolastico'
  };
}
