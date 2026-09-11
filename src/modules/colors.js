/**
 * Modulo per il Color Coding universale delle materie e delle classi,
 * e helper per la pulizia dei nomi e formattazione della durata.
 */

// Palette coerente e armoniosa per le materie (Matematica = Blu cobalto, Fisica = Verde smeraldo)
const SUBJECT_COLOR_RULES = [
  {
    pattern: /matematica|^\s*mat\b/i,
    color: '#3b82f6', // Blu cobalto
    bg: 'rgba(59, 130, 246, 0.14)',
    border: '#60a5fa'
  },
  {
    pattern: /fisica|^\s*fis\b/i,
    color: '#10b981', // Verde smeraldo
    bg: 'rgba(16, 185, 129, 0.14)',
    border: '#34d399'
  },
  {
    pattern: /italiano|lettere|^\s*ita\b/i,
    color: '#e11d48', // Rosso corallo / Carminio
    bg: 'rgba(225, 29, 72, 0.14)',
    border: '#f43f5e'
  },
  {
    pattern: /latino|greco/i,
    color: '#7c3aed', // Viola / Pervinca
    bg: 'rgba(124, 58, 237, 0.14)',
    border: '#8b5cf6'
  },
  {
    pattern: /inglese|straniera|lingua/i,
    color: '#ea580c', // Arancio dorato
    bg: 'rgba(234, 88, 12, 0.14)',
    border: '#f97316'
  },
  {
    pattern: /storia|filosofia/i,
    color: '#d97706', // Ocra / Ambra calda
    bg: 'rgba(217, 119, 6, 0.14)',
    border: '#f59e0b'
  },
  {
    pattern: /scienze|chimica|biologia|geografia/i,
    color: '#0891b2', // Ciano profondo
    bg: 'rgba(8, 145, 178, 0.14)',
    border: '#06b6d4'
  },
  {
    pattern: /arte|disegno/i,
    color: '#db2777', // Magenta / Rosa antico
    bg: 'rgba(219, 39, 119, 0.14)',
    border: '#ec4899'
  },
  {
    pattern: /motori|sport|ed\. fisica/i,
    color: '#65a30d', // Lime / Oliva bosco
    bg: 'rgba(101, 163, 13, 0.14)',
    border: '#84cc16'
  },
  {
    pattern: /religione|alternativa/i,
    color: '#64748b', // Ardesia neutro
    bg: 'rgba(100, 116, 139, 0.14)',
    border: '#94a3b8'
  },
  {
    pattern: /disposizione/i,
    color: '#d97706', // Oro ambra
    bg: 'rgba(217, 119, 6, 0.14)',
    border: '#f59e0b'
  }
];

// Palette di fallback deterministica per materie rare
const FALLBACK_PALETTE = [
  '#0284c7', '#0d9488', '#4f46e5', '#9333ea',
  '#c026d3', '#e11d48', '#d97706', '#059669'
];

/**
 * Restituisce i colori associati a una materia.
 */
export function getSubjectColor(subjectName = '', subjectCode = '') {
  const combined = `${subjectName} ${subjectCode}`.trim();

  for (const rule of SUBJECT_COLOR_RULES) {
    if (rule.pattern.test(combined)) {
      return {
        color: rule.color,
        bg: rule.bg,
        border: rule.border
      };
    }
  }

  // Hash deterministico
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
  }
  const color = FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
  return {
    color,
    bg: 'rgba(255, 255, 255, 0.06)',
    border: color
  };
}

/**
 * Color coding per le classi:
 * - Scientifico Ordinamentale (Blu freddo): 1ª chiaro (#60a5fa) -> 5ª profondo (#1e40af)
 * - Scienze Applicate (Verde freddo): 1ª menta (#34d399) -> 5ª pino (#065f46)
 * - Scientifico Sportivo (Grigio/Slate tecnico): 1ª slate (#94a3b8) -> 5ª slate (#1e293b)
 * - Esabac (Intermedio Indaco/Violetto): 1ª lavanda (#a78bfa) -> 5ª violetto (#5b21b6)
 * - Classico (Caldi Terracotta/Rame): 1ª albicocca (#fb923c) -> 5ª mogano (#9a3412)
 */
const TRACK_PALETTES = {
  // Caldo: Classico (Sezioni Alfa, Beta, Gamma o "Classico")
  classico: {
    name: 'Classico',
    shades: {
      '1': '#fb923c', // 1ª ginnasio (più chiaro/luminoso)
      '2': '#f97316',
      '3': '#ea580c',
      '4': '#c2410c',
      '5': '#9a3412'  // 3ª liceo (profondo)
    }
  },
  // Intermedio: Esabac (Indaco / Violetto)
  esabac: {
    name: 'Esabac',
    shades: {
      '1': '#a78bfa',
      '2': '#8b5cf6',
      '3': '#7c3aed',
      '4': '#6d28d9',
      '5': '#5b21b6'
    }
  },
  // Freddo: Scienze Applicate (Verde freddo / Smeraldo)
  applicate: {
    name: 'Scienze Applicate',
    shades: {
      '1': '#34d399',
      '2': '#10b981',
      '3': '#059669',
      '4': '#047857',
      '5': '#065f46'
    }
  },
  // Freddo: Sportivo (Slate tecnico con sfumatura indaco freddo ad alto contrasto)
  sportivo: {
    name: 'Sportivo',
    shades: {
      '1': '#c7d2fe', // 1ª indaco polvere chiaro
      '2': '#a5b4fc', // 2ª indaco perla
      '3': '#818cf8', // 3ª indaco tecnico
      '4': '#6366f1', // 4ª indaco vivido
      '5': '#4f46e5'  // 5ª indaco profondo luminoso (mai scuro/invisibile)
    }
  },
  // Freddo: Scientifico Ordinamentale (Blu)
  ordinamentale: {
    name: 'Ordinamentale',
    shades: {
      '1': '#60a5fa',
      '2': '#3b82f6',
      '3': '#2563eb',
      '4': '#1d4ed8',
      '5': '#1e40af'
    }
  }
};

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

  const track = TRACK_PALETTES[trackKey] || TRACK_PALETTES.ordinamentale;
  const color = track.shades[grade] || track.shades['1'];

  return {
    color,
    bg: `${color}1f`, // ~12% opacity in hex
    border: color,
    trackKey,
    trackName: track.name,
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

