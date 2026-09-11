/**
 * Gestore del LocalStorage per l'applicazione Orario Pellicano.
 * Salva e recupera cache XML, preferenze utente, default view e preferiti.
 */

const STORAGE_KEYS = {
  XML_RAW: 'orario_pellicano_xml_raw',
  XML_HASH: 'orario_pellicano_xml_hash',
  LAST_SYNC: 'orario_pellicano_last_sync',
  DEFAULT_VIEW: 'orario_pellicano_default_view',
  FAVORITES: 'orario_pellicano_favorites',
  PROXY_URL: 'orario_pellicano_proxy_url',
  THEME: 'orario_pellicano_theme'
};

export const DEFAULT_PROXY_URL = 'https://proxy-orario-pellicano.[inserisci-qui-il-tuo-account].workers.dev';

/**
 * Calcola un hash rapido e affidabile (FNV-1a 32-bit hex) di una stringa.
 */
export function computeStringHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Recupera l'XML memorizzato in cache.
 */
export function getCachedXml() {
  try {
    return localStorage.getItem(STORAGE_KEYS.XML_RAW);
  } catch (e) {
    console.warn('Impossibile accedere al localStorage:', e);
    return null;
  }
}

/**
 * Recupera l'hash dell'XML memorizzato.
 */
export function getCachedXmlHash() {
  try {
    return localStorage.getItem(STORAGE_KEYS.XML_HASH);
  } catch (e) {
    return null;
  }
}

/**
 * Salva l'XML e il relativo hash nella cache locale.
 */
export function saveXmlCache(rawXml, hash = null) {
  try {
    const computedHash = hash || computeStringHash(rawXml);
    localStorage.setItem(STORAGE_KEYS.XML_RAW, rawXml);
    localStorage.setItem(STORAGE_KEYS.XML_HASH, computedHash);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    return computedHash;
  } catch (e) {
    console.warn('Errore salvataggio cache XML in localStorage:', e);
    return null;
  }
}

/**
 * Recupera la data e ora dell'ultimo sync.
 */
export function getLastSyncTime() {
  try {
    const iso = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return iso ? new Date(iso) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Recupera la vista predefinita dell'utente (Default View).
 */
export function getDefaultView() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEFAULT_VIEW);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Imposta la vista predefinita (es. classe o docente preferito che si apre all'avvio).
 */
export function setDefaultView(type, id, title = '') {
  try {
    const pref = { type, id, title, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_KEYS.DEFAULT_VIEW, JSON.stringify(pref));
    return pref;
  } catch (e) {
    return null;
  }
}

/**
 * Rimuove la vista predefinita.
 */
export function clearDefaultView() {
  try {
    localStorage.removeItem(STORAGE_KEYS.DEFAULT_VIEW);
  } catch (e) {}
}

/**
 * Recupera la lista dei preferiti salvati.
 */
export function getFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Aggiunge o rimuove un elemento dai preferiti.
 */
export function toggleFavorite(type, id, title) {
  try {
    let favs = getFavorites();
    const index = favs.findIndex(f => f.type === type && f.id === id);
    let added = false;
    if (index >= 0) {
      favs.splice(index, 1);
    } else {
      favs.push({ type, id, title });
      added = true;
    }
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
    return { added, favorites: favs };
  } catch (e) {
    return { added: false, favorites: [] };
  }
}

/**
 * Verifica se un'entità è tra i preferiti.
 */
export function isFavorite(type, id) {
  const favs = getFavorites();
  return favs.some(f => f.type === type && f.id === id);
}



/**
 * Recupera il tema salvato (dark / light).
 */
export function getTheme() {
  try {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  } catch (e) {
    return 'dark';
  }
}

/**
 * Imposta il tema.
 */
export function setTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
}
