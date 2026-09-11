/**
 * Modulo per il Color Coding universale delle materie e delle classi,
 * e helper per la pulizia dei nomi e formattazione della durata.
 */

import {
  getSubjectRules,
  getTrackPalettes,
  getFallbackPalette
} from './themeManager.js';

/**
 * Restituisce i colori associati a una materia.
 */
export function getSubjectColor(subjectName = '', subjectCode = '') {
  const combined = `${subjectName} ${subjectCode}`.trim();
  const rules = getSubjectRules();

  for (const rule of rules) {
    const isMatch = rule.regex ? rule.regex.test(combined) : new RegExp(rule.pattern, 'i').test(combined);
    if (isMatch) {
      return {
        color: rule.color,
        bg: rule.bg || `${rule.color}24`,
        border: rule.border || rule.color
      };
    }
  }

  // Hash deterministico per materie senza regola esplicita
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
  }
  const fallbackPalette = getFallbackPalette();
  const color = fallbackPalette[hash % fallbackPalette.length];
  return {
    color,
    bg: 'rgba(255, 255, 255, 0.06)',
    border: color
  };
}

/**
 * Restituisce i dettagli completi sul colore e l'indirizzo della classe.
 */
export function getClassColorInfo(className = '', fullClassName = '') {
  const shortUpper = (className || '').trim().toUpperCase();
  const fullUpper = (fullClassName || '').trim().toUpperCase();
  const combined = `${shortUpper} ${fullUpper}`.trim();

  // 1. Identificazione Anno (1-5)
  const matchGrade = shortUpper.match(/(\d)/) || combined.match(/(\d)/);
  const grade = matchGrade ? matchGrade[1] : '1';

  // 2. Identificazione Sezione (es. "3F" -> "F", "3T" -> "T", ".1ALFA" -> "ALFA")
  const section = shortUpper.replace(/^[.\d\s]+/, '').trim();

  // 3. Identificazione Indirizzo con euristica sezioni Liceo Peano-Pellico
  let trackKey = 'ordinamentale';
  let customTrackName = null;

  if (
    combined.includes('ALFA') ||
    combined.includes('BETA') ||
    combined.includes('GAMMA') ||
    combined.includes('CLASSICO') ||
    combined.includes('GINNASIO') ||
    shortUpper.startsWith('.') ||
    section === 'ALFA' ||
    section === 'BETA' ||
    section === 'GAMMA'
  ) {
    trackKey = 'classico';
    if (combined.includes('DIGITALE')) {
      customTrackName = 'Classico Digitale';
    } else if (combined.includes('ESABAC')) {
      customTrackName = 'Classico Esabac';
    } else {
      customTrackName = 'Classico';
    }
  } else if (
    combined.includes('ESABAC') ||
    section === 'H'
  ) {
    trackKey = 'esabac';
  } else if (
    combined.includes('SPORTIVO') ||
    combined.includes(' SPORT') ||
    section === 'S' ||
    section === 'T'
  ) {
    trackKey = 'sportivo';
  } else if (
    combined.includes('SC.APPLICATE') ||
    combined.includes('APPLICATE') ||
    combined.includes('RONDINE') ||
    section === 'E' ||
    section === 'F' ||
    section === 'G' ||
    section === 'I' ||
    section === 'R'
  ) {
    trackKey = 'applicate';
  } else if (
    combined.includes('ORDINAM') ||
    section === 'A' ||
    section === 'B' ||
    section === 'C' ||
    section === 'D'
  ) {
    trackKey = 'ordinamentale';
  }

  const trackPalettes = getTrackPalettes();
  const track = trackPalettes[trackKey] || trackPalettes.ordinamentale;
  const color = (track && track.shades && track.shades[grade]) || (track && track.shades && track.shades['1']) || '#3b82f6';

  return {
    color,
    bg: `${color}1f`, // ~12% opacity in hex
    border: color,
    trackKey,
    trackName: customTrackName || (track ? track.name : 'Classe'),
    grade
  };
}

/**
 * Restituisce il colore esadecimale associato a una classe per retrocompatibilità.
 */
export function getClassColor(className = '', fullClassName = '') {
  return getClassColorInfo(className, fullClassName).color;
}

/**
 * Pulisce il nome della materia rimuovendo i codici tra parentesi (es. "(I011)" o "(I015)").
 * Converte in formato leggibile e pulito.
 */
export function cleanSubjectName(rawName = '') {
  if (!rawName) return '';
  // Rimuove qualsiasi contenuto tra parentesi tonde es. (I011), (DISPOSIZIONE)
  let cleaned = rawName.replace(/\s*\([^)]*\)/g, '').trim();

  // Se tutto maiuscolo con più parole, formatta secondo la sintassi italiana delle maiuscole (Sentence case)
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.toLowerCase();
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    // Mantiene maiuscole per nomi propri di lingue/discipline specifiche e acronimi
    const properNouns = [
      { regex: /\binglese\b/gi, replacement: 'Inglese' },
      { regex: /\bitaliano\b/gi, replacement: 'Italiano' },
      { regex: /\blatino\b/gi, replacement: 'Latino' },
      { regex: /\bspagnolo\b/gi, replacement: 'Spagnolo' },
      { regex: /\bfrancese\b/gi, replacement: 'Francese' },
      { regex: /\btedesco\b/gi, replacement: 'Tedesco' },
      { regex: /\birc\b/gi, replacement: 'IRC' },
      { regex: /\btic\b/gi, replacement: 'TIC' },
      { regex: /\bstem\b/gi, replacement: 'STEM' },
      { regex: /\bed\b/gi, replacement: 'Ed.' },
      { regex: /\bita\b/gi, replacement: 'Italiano' }
    ];

    properNouns.forEach(({ regex, replacement }) => {
      cleaned = cleaned.replace(regex, replacement);
    });
  }

  return cleaned || rawName;
}

/**
 * Formatta la durata secondo le specifiche dell'utente: "1 ora", "2 ore", "3 ore".
 */
export function formatDurationLabel(durataStr = '', durataHours = 1) {
  const hours = durataHours || 1;
  if (hours === 1) return '1 ora';
  return `${hours} ore`;
}

/**
 * Restituisce una versione abbreviata e ad alta leggibilità della materia per la vista a tabella e Canvas.
 * Esempi: "Lingua e letteratura italiana" -> "Italiano", "Scienze motorie e sportive" -> "Scienze motorie",
 * "Scienze naturali..." -> "Scienze", "Disegno e storia dell'arte" -> "Arte", "Religione..." -> "Religione/AA".
 */
export function getGridSubjectName(rawName = '', matCod = '') {
  if (!rawName && !matCod) return '';
  const upper = `${rawName} ${matCod || ''}`.toUpperCase();

  if (upper.includes('LETTERATURA ITALIANA') || upper.includes('LINGUA ITALIANA') || matCod === 'ITA') {
    return 'Italiano';
  }
  if (upper.includes('CULTURA GRECA') || upper.includes('LETTERATURA GRECA') || matCod === 'GRECO') {
    return 'Greco';
  }
  if (upper.includes('CULTURA LATINA') || upper.includes('LETTERATURA LATINA') || matCod === 'LATINO' || matCod === 'LAT') {
    return 'Latino';
  }
  if (upper.includes('SCIENZE MOTORIE') || matCod === 'SC.MOT' || matCod === 'SCIENZE MOT') {
    return 'Scienze motorie';
  }
  if (upper.includes('SCIENZE NATURALI') || (upper.includes('SCIENZE') && (upper.includes('BIOLOGIA') || upper.includes('CHIMICA') || matCod === 'SCIENZE'))) {
    return 'Scienze';
  }
  if (upper.includes('RELIGIONE') || upper.includes('ATTIVIT') || upper.includes('IRC') || matCod === 'REL' || matCod === 'IRC') {
    return 'Religione/AA';
  }
  if (upper.includes('DISEGNO E STORIA DELL') || upper.includes('STORIA DELL\'ARTE') || matCod === 'DIS/ARTE' || matCod === 'ARTE') {
    return 'Arte';
  }
  if (upper.includes('STORIA E GEOGRAFIA') || matCod === 'GEOSTORIA') {
    return 'Geostoria';
  }
  if (upper.includes('CULTURA STRANIERA') && upper.includes('INGLESE')) {
    return 'Inglese';
  }
  if (upper.includes('CULTURA STRANIERA') && upper.includes('FRANCESE')) {
    return 'Francese';
  }
  if (upper.includes('CULTURA STRANIERA') && upper.includes('SPAGNOLO')) {
    return 'Spagnolo';
  }
  if (upper.includes('CULTURA STRANIERA') && upper.includes('TEDESCO')) {
    return 'Tedesco';
  }
  if (upper.includes('DISCIPLINE SPORTIVE')) {
    return 'Disc. sportive';
  }

  return cleanSubjectName(rawName || matCod);
}

/**
 * Restituisce la sigla ultra-sintetica a 3-4 lettere per la modalità compatta (Fit to Screen) su mobile.
 * Es: Italiano -> Ita, Matematica -> Mat, Fisica -> Fis, Scienze -> Sci, Disposizione -> Disp.
 */
export function getUltraCompactSubjectName(rawName = '', matCod = '') {
  if (!rawName && !matCod) return '';
  const upper = `${rawName} ${matCod || ''}`.toUpperCase();

  if (upper.includes('DISPOSIZIONE')) return 'Disp';
  if (upper.includes('LETTERATURA ITALIANA') || upper.includes('LINGUA ITALIANA') || matCod === 'ITA') return 'Ita';
  if (upper.includes('MATEMATICA') || matCod === 'MAT') return 'Mat';
  if (upper.includes('FISICA') || matCod === 'FIS') return 'Fis';
  if (upper.includes('INFORMATICA') || matCod === 'INF') return 'Inf';
  if (upper.includes('FILOSOFIA') || matCod === 'FIL') return 'Fil';
  if (upper.includes('STORIA E GEOGRAFIA') || matCod === 'GEOSTORIA') return 'Geo';
  if (upper.includes('STORIA') || matCod === 'STO') return 'Sto';
  if (upper.includes('GEOGRAFIA') || matCod === 'GEO') return 'Geo';
  if (upper.includes('SCIENZE MOTORIE') || matCod === 'SC.MOT' || matCod === 'SCIENZE MOT') return 'Mot';
  if (upper.includes('SCIENZE') || matCod === 'SCIENZE' || upper.includes('CHIMICA') || upper.includes('BIOLOGIA')) return 'Sci';
  if (upper.includes('RELIGIONE') || upper.includes('ATTIVIT') || upper.includes('IRC') || matCod === 'REL') return 'Rel';
  if (upper.includes('DISEGNO') || upper.includes('ARTE') || matCod === 'ARTE' || matCod === 'DIS/ARTE') return 'Arte';
  if (upper.includes('CULTURA LATINA') || matCod === 'LATINO' || matCod === 'LAT') return 'Lat';
  if (upper.includes('CULTURA GRECA') || matCod === 'GRECO') return 'Gre';
  if (upper.includes('INGLESE') || matCod === 'ING') return 'Ing';
  if (upper.includes('FRANCESE') || matCod === 'FRA') return 'Fra';
  if (upper.includes('SPAGNOLO') || matCod === 'SPA') return 'Spa';
  if (upper.includes('TEDESCO') || matCod === 'TED') return 'Ted';
  if (upper.includes('DISCIPLINE SPORTIVE')) return 'Sport';

  const base = cleanSubjectName(rawName || matCod);
  return base.length > 4 ? base.substring(0, 4) : base;
}


