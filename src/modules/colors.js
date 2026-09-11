/**
 * Modulo per il Color Coding universale delle materie e delle classi,
 * e helper per la pulizia dei nomi e formattazione della durata.
 */

// Mappa esplicita delle materie: Matematica = BLU (#2563eb), Fisica = VERDE (#10b981)
const SUBJECT_COLOR_RULES = [
  {
    pattern: /matematica|^\s*mat\b/i,
    color: '#2563eb', // Blu
    bg: 'rgba(37, 99, 235, 0.15)',
    border: '#3b82f6'
  },
  {
    pattern: /fisica|^\s*fis\b/i,
    color: '#10b981', // Verde
    bg: 'rgba(16, 185, 129, 0.15)',
    border: '#10b981'
  },
  {
    pattern: /italiano|lettere|^\s*ita\b/i,
    color: '#e11d48', // Rosso corallo / Bordeaux
    bg: 'rgba(225, 29, 72, 0.15)',
    border: '#f43f5e'
  },
  {
    pattern: /latino|greco/i,
    color: '#7c3aed', // Viola / Indaco
    bg: 'rgba(124, 58, 237, 0.15)',
    border: '#8b5cf6'
  },
  {
    pattern: /inglese|straniera|lingua/i,
    color: '#ea580c', // Arancione
    bg: 'rgba(234, 88, 12, 0.15)',
    border: '#f97316'
  },
  {
    pattern: /storia|filosofia/i,
    color: '#d97706', // Ocra / Ambra
    bg: 'rgba(217, 119, 6, 0.15)',
    border: '#f59e0b'
  },
  {
    pattern: /scienze|chimica|biologia|geografia/i,
    color: '#06b6d4', // Ciano / Ocean
    bg: 'rgba(6, 182, 212, 0.15)',
    border: '#22d3ee'
  },
  {
    pattern: /arte|disegno/i,
    color: '#db2777', // Magenta / Rosa
    bg: 'rgba(219, 39, 119, 0.15)',
    border: '#ec4899'
  },
  {
    pattern: /motori|sport|ed\. fisica/i,
    color: '#65a30d', // Lime
    bg: 'rgba(101, 163, 13, 0.15)',
    border: '#84cc16'
  },
  {
    pattern: /religione|alternativa/i,
    color: '#64748b', // Ardesia
    bg: 'rgba(100, 116, 139, 0.15)',
    border: '#94a3b8'
  },
  {
    pattern: /disposizione/i,
    color: '#f59e0b', // Ambra Oro
    bg: 'rgba(245, 158, 11, 0.15)',
    border: '#fbbf24'
  }
];

// Palette di fallback deterministica per materie non censite
const FALLBACK_PALETTE = [
  '#0284c7', '#0d9488', '#4f46e5', '#9333ea',
  '#c026d3', '#e11d48', '#d97706', '#059669'
];

/**
 * Restituisce i colori associati a una materia (Matematica = blu, Fisica = verde, ecc.)
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
    bg: 'rgba(255, 255, 255, 0.05)',
    border: color
  };
}

/**
 * Restituisce il colore associato a una classe in base all'anno di corso (1ª-5ª).
 */
export function getClassColor(className = '') {
  const match = className.match(/(\d)/);
  const grade = match ? match[1] : '1';

  switch (grade) {
    case '1': return '#0284c7'; // 1ª: Sky Blue
    case '2': return '#0d9488'; // 2ª: Teal
    case '3': return '#6366f1'; // 3ª: Indigo
    case '4': return '#8b5cf6'; // 4ª: Viola
    case '5': return '#d97706'; // 5ª: Ambra
    default: return '#14b8a6';
  }
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
