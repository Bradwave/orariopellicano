/**
 * Modulo Dislocazione Aule.
 * Gestisce l'assegnazione fisica delle aule per ciascuna classe (numero aula, piano, ala)
 * con caricamento dinamico da src/config/classrooms.json e fallback incorporato.
 */

// Configurazione di base sincronizzata (fallback immediato O(1))
let CLASSROOMS_MAP = {
  "1A": { "aula": "37", "piano": "2º", "ala": "v. M. Zovetto" },
  "1B": { "aula": "38", "piano": "2º", "ala": "v. M. Zovetto" },
  "1E": { "aula": "5", "piano": "1º", "ala": "v. M. Zovetto" },
  "1F": { "aula": "6", "piano": "1º", "ala": "v. M. Zovetto" },
  "1G": { "aula": "4", "piano": "1º", "ala": "v. M. Zovetto" },
  "1H": { "aula": "8", "piano": "1º", "ala": "v. M. Zovetto" },
  "1S": { "aula": "9", "piano": "1º", "ala": "v. M. Zovetto" },
  "1T": { "aula": "7", "piano": "1º", "ala": "v. M. Zovetto" },
  "1ALFA": { "aula": "33", "piano": "2º", "ala": "v. M. Zovetto", "display": "1α" },
  "1BETA": { "aula": "34", "piano": "2º", "ala": "v. M. Zovetto", "display": "1β" },

  "2A": { "aula": "3", "piano": "1º", "ala": "v. XX Settembre" },
  "2B": { "aula": "40", "piano": "2º", "ala": "v. M. Zovetto" },
  "2C": { "aula": "41", "piano": "2º", "ala": "v. M. Zovetto" },
  "2E": { "aula": "39", "piano": "2º", "ala": "v. M. Zovetto" },
  "2F": { "aula": "10", "piano": "1º", "ala": "v. M. Zovetto" },
  "2G": { "aula": "12", "piano": "1º", "ala": "v. Q. Sella" },
  "2H": { "aula": "8 BIS", "piano": "1º", "ala": "v. M. Zovetto" },
  "2S": { "aula": "11", "piano": "1º", "ala": "v. M. Zovetto" },
  "2T": { "aula": "4 bis", "piano": "1º", "ala": "v. M. Zovetto" },
  "2ALFA": { "aula": "36", "piano": "2º", "ala": "v. M. Zovetto", "display": "2α" },
  "2BETA": { "aula": "35", "piano": "2º", "ala": "v. M. Zovetto", "display": "2β" },

  "3A": { "aula": "53", "piano": "2º", "ala": "centrale" },
  "3C": { "aula": "45", "piano": "2º", "ala": "v. Q. Sella" },
  "3E": { "aula": "88", "piano": "3º", "ala": "C.so G. Giolitti" },
  "3F": { "aula": "89", "piano": "3º", "ala": "C.so G. Giolitti" },
  "3G": { "aula": "47", "piano": "2º", "ala": "v. Q. Sella" },
  "3H": { "aula": "94", "piano": "3º", "ala": "C.so G. Giolitti" },
  "3I": { "aula": "97", "piano": "3º", "ala": "v. XX Settembre" },
  "3R": { "aula": "96", "piano": "1º", "ala": "ammezz. scient." },
  "3S": { "aula": "54", "piano": "2º", "ala": "centrale" },
  "3T": { "aula": "55", "piano": "2º", "ala": "v. M. Zovetto" },
  "3ALFA": { "aula": "64", "piano": "2º", "ala": "C.so G. Giolitti", "display": "3α" },
  "3BETA": { "aula": "68", "piano": "2º", "ala": "v. XX Settembre", "display": "3β" },
  "3GAMMA": { "aula": "69", "piano": "2º", "ala": "v. XX Settembre", "display": "3γ" },

  "4A": { "aula": "56", "piano": "2º", "ala": "centrale" },
  "4B": { "aula": "57", "piano": "2º", "ala": "centrale" },
  "4C": { "aula": "58", "piano": "2º", "ala": "centrale" },
  "4D": { "aula": "59", "piano": "2º", "ala": "centrale" },
  "4F": { "aula": "46", "piano": "2º", "ala": "v. Q. Sella" },
  "4G": { "aula": "86", "piano": "3º", "ala": "v. Q. Sella" },
  "4H": { "aula": "95", "piano": "3º", "ala": "C.so G. Giolitti" },
  "4R": { "aula": "96", "piano": "3º", "ala": "C.so G. Giolitti" },
  "4S": { "aula": "44", "piano": "2º", "ala": "v. Q. Sella" },
  "4ALFA": { "aula": "63", "piano": "2º", "ala": "C.so G. Giolitti", "display": "4α" },
  "4BETA": { "aula": "70", "piano": "2º", "ala": "v. XX Settembre", "display": "4β" },
  "4GAMMA": { "aula": "71", "piano": "2º", "ala": "v. XX Settembre", "display": "4γ" },

  "5A": { "aula": "99", "piano": "3º", "ala": "v. XX Settembre" },
  "5B": { "aula": "73", "piano": "3º", "ala": "v. M. Zovetto" },
  "5C": { "aula": "75", "piano": "3º", "ala": "v. M. Zovetto" },
  "5D": { "aula": "74", "piano": "3º", "ala": "v. M. Zovetto" },
  "5E": { "aula": "90", "piano": "3º", "ala": "C.so G. Giolitti" },
  "5F": { "aula": "76", "piano": "3º", "ala": "v. M. Zovetto" },
  "5G": { "aula": "77", "piano": "3º", "ala": "v. M. Zovetto" },
  "5S": { "aula": "42", "piano": "2º", "ala": "v. M. Zovetto" },
  "5ALFA": { "aula": "51", "piano": "2º", "ala": "C.so G. Giolitti", "display": "5α" },
  "5BETA": { "aula": "50", "piano": "2º", "ala": "C.so G. Giolitti", "display": "5β" },
  "5GAMMA": { "aula": "49", "piano": "2º", "ala": "C.so G. Giolitti", "display": "5γ" }
};

/**
 * Carica dinamicamente il file classrooms.json da src/config/ o public/.
 */
export async function initClassroomsConfig() {
  try {
    let res = await fetch('./src/config/classrooms.json');
    if (!res.ok) {
      res = await fetch('./public/classrooms.json');
    }
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        CLASSROOMS_MAP = data;
      }
    }
  } catch (e) {
    // Fallback sicuro al dataset predefinito
  }
}

// Avvia il caricamento asincrono all'import
initClassroomsConfig();

/**
 * Normalizza qualsiasi stringa classe (es. "1 A", "1A", "1 α", "1ALFA", ".1ALFA ORDINAM.")
 * nella chiave canonica (es. "1A", "1ALFA").
 * @param {string} classInput
 * @returns {string} Chiave normalizzata
 */
export function normalizeClassKey(classInput) {
  if (!classInput || typeof classInput !== 'string') return '';
  
  let cleaned = classInput
    .replace(/^[.\s]+/, '')
    .trim()
    .toUpperCase();

  // Estrai prima porzione se stringa complessa (es. "1A ORDINAM." -> "1A")
  const firstWord = cleaned.split(' ')[0] || cleaned;

  // Traduci simboli greci in ALFA, BETA, GAMMA
  let normalized = firstWord
    .replace(/^(\d+)[-\s]?Α$/i, '$1ALFA') // Greco maiuscolo Alpha
    .replace(/^(\d+)[-\s]?α$/i, '$1ALFA') // Greco minuscolo alpha
    .replace(/^(\d+)[-\s]?Β$/i, '$1BETA') // Greco maiuscolo Beta
    .replace(/^(\d+)[-\s]?β$/i, '$1BETA') // Greco minuscolo beta
    .replace(/^(\d+)[-\s]?Γ$/i, '$1GAMMA') // Greco maiuscolo Gamma
    .replace(/^(\d+)[-\s]?γ$/i, '$1GAMMA') // Greco minuscolo gamma
    .replace(/\s+/g, '');

  // Se c'è spazio tra numero e lettera (es. "1 A" -> "1A")
  if (/^\d+[A-Z]+$/.test(normalized)) {
    return normalized;
  }

  // Prova a fare match se la stringa originaria conteneva "1 A"
  const spacedMatch = cleaned.match(/^(\d+)\s+([A-Zα-γΑ-Γ]+)/i);
  if (spacedMatch) {
    const num = spacedMatch[1];
    let sec = spacedMatch[2];
    sec = sec
      .replace(/[αΑ]/g, 'ALFA')
      .replace(/[βΒ]/g, 'BETA')
      .replace(/[γΓ]/g, 'GAMMA');
    return `${num}${sec}`.toUpperCase();
  }

  return normalized;
}

/**
 * Restituisce la chiave identificativa dell'ala per il color coding.
 * @param {string} ala - Stringa ala
 * @returns {'zovetto'|'xx-settembre'|'giolitti'|'sella'|'centrale'}
 */
export function getWingKey(ala = '') {
  const a = (ala || '').toLowerCase();
  if (a.includes('zovetto')) return 'zovetto';
  if (a.includes('xx') || a.includes('settembre')) return 'xx-settembre';
  if (a.includes('giolitti')) return 'giolitti';
  if (a.includes('sella')) return 'sella';
  return 'centrale';
}

/**
 * Restituisce le informazioni sull'aula assegnata a una classe.
 * @param {string} classInput - Nome o codice della classe (es. "1 A", "1A", "1α", "1ALFA")
 * @returns {object|null} Informazioni su aula, piano e ala, o null se non trovata
 */
export function getClassroomInfo(classInput) {
  if (!classInput) return null;

  const key = normalizeClassKey(classInput);
  let item = CLASSROOMS_MAP[key];

  if (!item) {
    // Prova alternativa cercando chiavi con prefisso
    const matchingKey = Object.keys(CLASSROOMS_MAP).find(k => {
      return key.startsWith(k) || k.startsWith(key);
    });
    if (matchingKey) item = CLASSROOMS_MAP[matchingKey];
  }

  if (!item) return null;

  const pianoLabel = item.piano.includes('piano') || item.piano.includes('scient')
    ? item.piano
    : `${item.piano} Piano`;

  const wingKey = getWingKey(item.ala);
  const wingClass = `wing-${wingKey}`;

  return {
    aula: item.aula,
    piano: item.piano,
    ala: item.ala,
    wingKey,
    wingClass,
    display: item.display || key,
    fullLocation: `${pianoLabel} • Ala ${item.ala}`,
    fullText: `Aula ${item.aula} — ${pianoLabel} (${item.ala})`,
    badgeText: `Aula ${item.aula} • ${item.piano} p.`,
    shortBadge: `Aula ${item.aula}`
  };
}

/**
 * Restituisce la classe assegnata a un'aula (ricerca inversa).
 * @param {string} aulaNum - Numero aula (es. "37", "4 bis")
 * @returns {Array<object>} Lista classi associate a quell'aula
 */
export function findClassByRoom(aulaNum) {
  if (!aulaNum) return [];
  const query = String(aulaNum).trim().toLowerCase();
  
  const results = [];
  for (const [classKey, data] of Object.entries(CLASSROOMS_MAP)) {
    if (String(data.aula).trim().toLowerCase() === query) {
      results.push({
        classKey,
        ...data
      });
    }
  }
  return results;
}

/**
 * Restituisce l'intero elenco delle aule.
 */
export function getAllClassrooms() {
  return { ...CLASSROOMS_MAP };
}
