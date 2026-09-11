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
    trackName: track ? track.name : 'Classe',
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

  // Se tutto maiuscolo con più parole, formatta con capitalizzazione pulita
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.toLowerCase().replace(/(^|\s|-)\S/g, l => l.toUpperCase());
    // Mantiene acronimi speciali
    cleaned = cleaned.replace(/\bEd\b/g, 'Ed.').replace(/\bIta\b/g, 'Italiano');
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

