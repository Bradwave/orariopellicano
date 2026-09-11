/**
 * Parser per export XML standard EDT Index Education.
 * Estrae l'albero XML in una struttura JSON pulita, navigabile e indicizzata.
 */

// Giorni standard scolastici ordinati
export const DAYS_ORDER = [
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato'
];

/**
 * Converte una stringa oraria "07h55" in minuti da mezzanotte per ordinamento e calcoli.
 */
export function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/^(\d{1,2})h(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Converte i minuti da mezzanotte nel formato standard "HH:MM".
 */
export function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Estrae la durata in ore intere da stringhe tipo "1h00", "2h00", "3h00".
 */
export function parseDurationHours(durationStr) {
  if (!durationStr) return 1;
  const match = durationStr.match(/^(\d+)h/);
  return match ? Math.max(1, parseInt(match[1], 10)) : 1;
}

/**
 * Ottiene il testo interno sicuro di un tag XML da un nodo genitore.
 */
function getNodeText(parentNode, tagName) {
  const elems = parentNode.getElementsByTagName(tagName);
  if (elems && elems.length > 0) {
    return (elems[0].textContent || '').trim();
  }
  // Fallback per tag con caratteri speciali (es. O.INIZIO, CO-DOC.)
  for (let i = 0; i < parentNode.children.length; i++) {
    const child = parentNode.children[i];
    if (child.nodeName === tagName || child.tagName === tagName) {
      return (child.textContent || '').trim();
    }
  }
  return '';
}

/**
 * Converte le sezioni con lettere greche scritte in lettere latine (ALFA, BETA, GAMMA)
 * nella corrispondente lettera greca tipografica (es. 1ALFA -> 1α, 2BETA -> 2β, 3GAMMA -> 3γ).
 */
export function formatClassDisplayName(shortName) {
  if (!shortName) return '';
  return shortName
    .replace(/^(\d+)ALFA$/i, '$1α')
    .replace(/^(\d+)BETA$/i, '$1β')
    .replace(/^(\d+)GAMMA$/i, '$1γ');
}

/**
 * Normalizza il nome della classe per la visualizzazione compatta e la ricerca.
 * Es. ".1ALFA ORDINAM." -> full: "1ALFA ORDINAM.", short: "1ALFA", displayShort: "1α"
 * Es. ".2BETA DIGITALE" -> full: "2BETA DIGITALE", short: "2BETA", displayShort: "2β"
 */
export function normalizeClassName(rawClass) {
  if (!rawClass) return { full: '', short: '', displayShort: '' };
  // Rimuove punti e spazi iniziali/finali spuri
  const cleaned = rawClass.replace(/^[.\s]+/, '').replace(/\s+/g, ' ').trim();
  // Riconosce sia sezioni standard (1A, 3F, 4T) sia sezioni in lettere greche (1ALFA, 2BETA, 3GAMMA)
  const shortMatch = cleaned.match(/^(\d+(?:ALFA|BETA|GAMMA|[A-Z]+))/i);
  const short = shortMatch ? shortMatch[1].toUpperCase() : (cleaned.split(' ')[0] || cleaned).toUpperCase();
  const displayShort = formatClassDisplayName(short);
  return { full: cleaned, short, displayShort };
}

/**
 * Parser principale del documento XML EDT.
 * @param {string} xmlString - Contenuto grezzo del file XML
 * @returns {object} Dataset indicizzato
 */
export function parseEDTXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Contenuto XML non valido o vuoto.');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Verifica errori di parsing XML
  const parserError = xmlDoc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new Error(`Errore di parsing XML: ${parserError[0].textContent}`);
  }

  const attivitaNodes = xmlDoc.getElementsByTagName('Attivita');
  if (!attivitaNodes || attivitaNodes.length === 0) {
    throw new Error('Nessun nodo <Attivita> trovato nel file XML.');
  }

  const rawActivities = [];
  const uniqueStartTimesSet = new Set();
  const classesMap = new Map();     // shortName -> { full, short }
  const teachersMap = new Map();    // teacherId -> { id, cognome, nome, displayName }
  const subjectsMap = new Map();    // code -> { code, name }

  for (let i = 0; i < attivitaNodes.length; i++) {
    const node = attivitaNodes[i];
    
    const numero = getNodeText(node, 'NUMERO') || `${i + 1}`;
    const durata = getNodeText(node, 'DURATA') || '1h00';
    const matCod = getNodeText(node, 'MAT_COD');
    const matNome = getNodeText(node, 'MAT_NOME') || matCod;
    const docCogn = getNodeText(node, 'DOC_COGN');
    const docNome = getNodeText(node, 'DOC_NOME');
    const rawClasse = getNodeText(node, 'CLASSE');
    const aula = getNodeText(node, 'AULA');
    const coDoc = getNodeText(node, 'CO-DOC.');
    const giorno = (getNodeText(node, 'GIORNO') || '').toLowerCase();
    const oInizio = getNodeText(node, 'O.INIZIO');
    const sede = getNodeText(node, 'SEDE');

    if (!giorno || !oInizio) continue;

    uniqueStartTimesSet.add(oInizio);

    // Normalizza classe
    const classInfo = normalizeClassName(rawClasse);
    if (classInfo.short) {
      if (!classesMap.has(classInfo.short)) {
        classesMap.set(classInfo.short, classInfo);
      }
    }

    // Normalizza docente
    let teacherId = '';
    let teacherDisplayName = '';
    if (docCogn) {
      teacherId = `${docCogn}${docNome ? ' ' + docNome : ''}`.trim();
      teacherDisplayName = docNome ? `${docCogn} ${docNome}` : docCogn;
      if (!teachersMap.has(teacherId)) {
        teachersMap.set(teacherId, {
          id: teacherId,
          cognome: docCogn,
          nome: docNome,
          displayName: teacherDisplayName
        });
      }
    }

    // Normalizza materia
    if (matCod) {
      if (!subjectsMap.has(matCod)) {
        subjectsMap.set(matCod, {
          code: matCod,
          name: matNome || matCod
        });
      }
    }

    rawActivities.push({
      numero,
      durata,
      durataHours: parseDurationHours(durata),
      matCod,
      matNome,
      docCogn,
      docNome,
      teacherId,
      teacherDisplayName,
      rawClasse,
      classeShort: classInfo.short,
      classeDisplayShort: classInfo.displayShort || classInfo.short,
      classeFull: classInfo.full,
      aula,
      isCoDocenza: coDoc.toUpperCase() === 'S',
      giorno,
      oInizio,
      startMinutes: timeStringToMinutes(oInizio),
      sede,
      isDisposizione: matCod.toUpperCase() === 'DISPOSIZIONE'
    });
  }

  // Costruisci le fasce orarie standard ordinate per orario di inizio
  const sortedStartTimes = Array.from(uniqueStartTimesSet).sort((a, b) => {
    return timeStringToMinutes(a) - timeStringToMinutes(b);
  });

  // Mappa delle fasce orarie (standard slot)
  const timeSlots = sortedStartTimes.map((oInizio, index) => {
    const startMins = timeStringToMinutes(oInizio);
    // Supponiamo 55 minuti per slot scolastico tipico EDT se non diversamente specificato
    const endMins = startMins + 55;
    const startTimeFormatted = minutesToTimeString(startMins);
    const endTimeFormatted = minutesToTimeString(endMins);

    return {
      index: index + 1, // 1ª ora, 2ª ora, ecc.
      oInizio,
      startTimeFormatted,
      endTimeFormatted,
      timeFormatted: `${startTimeFormatted} - ${endTimeFormatted}`,
      startMinutes: startMins,
      endMinutes: endMins
    };
  });

  const slotIndexByStartTime = new Map();
  timeSlots.forEach(slot => {
    slotIndexByStartTime.set(slot.oInizio, slot.index);
  });

  // Strutture indicizzate ad accesso rapido O(1)
  const byClass = {};
  const byTeacher = {};
  const bySubject = {};
  const substitutions = {}; // giorno -> slotIndex -> array docenti a disposizione

  DAYS_ORDER.forEach(day => {
    substitutions[day] = {};
    timeSlots.forEach(slot => {
      substitutions[day][slot.index] = [];
    });
  });

  // Indicizza ogni attività (gestendo le durate > 1h)
  rawActivities.forEach(act => {
    const baseSlotIndex = slotIndexByStartTime.get(act.oInizio) || 1;
    const span = act.durataHours || 1;

    for (let offset = 0; offset < span; offset++) {
      const currentSlotIndex = baseSlotIndex + offset;
      const currentSlot = timeSlots.find(s => s.index === currentSlotIndex);
      if (!currentSlot) break;

      const actInstance = {
        ...act,
        slotIndex: currentSlotIndex,
        slot: currentSlot,
        isContinuation: offset > 0
      };

      // Indicizzazione Sostituzioni (Disposizione)
      if (act.isDisposizione && act.teacherId) {
        if (!substitutions[act.giorno]) substitutions[act.giorno] = {};
        if (!substitutions[act.giorno][currentSlotIndex]) substitutions[act.giorno][currentSlotIndex] = [];
        substitutions[act.giorno][currentSlotIndex].push(actInstance);
      }

      // Indicizzazione per Classe
      if (act.classeShort) {
        if (!byClass[act.classeShort]) byClass[act.classeShort] = {};
        if (!byClass[act.classeShort][act.giorno]) byClass[act.classeShort][act.giorno] = {};
        if (!byClass[act.classeShort][act.giorno][currentSlotIndex]) {
          byClass[act.classeShort][act.giorno][currentSlotIndex] = [];
        }
        byClass[act.classeShort][act.giorno][currentSlotIndex].push(actInstance);
      }

      // Indicizzazione per Docente
      if (act.teacherId) {
        if (!byTeacher[act.teacherId]) byTeacher[act.teacherId] = {};
        if (!byTeacher[act.teacherId][act.giorno]) byTeacher[act.teacherId][act.giorno] = {};
        if (!byTeacher[act.teacherId][act.giorno][currentSlotIndex]) {
          byTeacher[act.teacherId][act.giorno][currentSlotIndex] = [];
        }
        byTeacher[act.teacherId][act.giorno][currentSlotIndex].push(actInstance);
      }

      // Indicizzazione per Materia
      if (act.matCod && !act.isDisposizione) {
        if (!bySubject[act.matCod]) bySubject[act.matCod] = [];
        bySubject[act.matCod].push(actInstance);
      }
    }
  });

  // Ordina elenchi per ricerca e visualizzazione
  const sortedClasses = Array.from(classesMap.values()).sort((a, b) => {
    return a.short.localeCompare(b.short, undefined, { numeric: true, sensitivity: 'base' });
  });

  const sortedTeachers = Array.from(teachersMap.values()).sort((a, b) => {
    return a.displayName.localeCompare(b.displayName);
  });

  const sortedSubjects = Array.from(subjectsMap.values())
    .filter(s => s.code.toUpperCase() !== 'DISPOSIZIONE')
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    timeSlots,
    days: DAYS_ORDER,
    classes: sortedClasses,
    teachers: sortedTeachers,
    subjects: sortedSubjects,
    byClass,
    byTeacher,
    bySubject,
    substitutions,
    totalActivities: rawActivities.length
  };
}
