/**
 * Modulo di rete per il recupero dell'orario XML e gestione intelligente degli aggiornamenti.
 * Architettura "Terza Via":
 * - Sfrutta la cache edge di Cloudflare per non sovraccaricare il server del liceo.
 * - Elimina gli header manuali non-standard per prevenire il blocco CORS preflight.
 * - Mantiene cache: 'no-store' a livello client per evitare copie locali stantie su mobile.
 */

import {
  getCachedXml,
  getCachedXmlHash,
  saveXmlCache,
  computeStringHash
} from './storage.js';

export const PRIMARY_PROXY_URL = 'https://proxy-orario-pellicano.bradwave-mb.workers.dev';
export const FALLBACK_XML_PATH = './default-schedule.xml';

/**
 * Recupera l'XML direttamente dal proxy Cloudflare.
 * La chiamata è una Simple Request (nessun header custom) per garantire compatibilità CORS al 100%.
 */
export async function fetchRemoteScheduleXml() {
  try {
    const res = await fetch(PRIMARY_PROXY_URL, {
      method: 'GET',
      cache: 'no-store', // Dice al browser locale di richiedere la versione fresca a Cloudflare
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });

    if (!res.ok) {
      throw new Error(`Server proxy (${res.status} ${res.statusText || 'Offline'})`);
    }

    const text = await res.text();
    if (text && text.includes('<Attivita')) {
      return text;
    } else {
      throw new Error('Risposta del server priva di dati orario validi');
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Esegue il fetch dell'XML con fallback locale in caso di assenza iniziale di rete.
 */
export async function fetchScheduleXml() {
  try {
    return await fetchRemoteScheduleXml();
  } catch (remoteErr) {
    console.warn('⚠️ [Network] Download remoto non riuscito, fallback sui dati locali:', remoteErr.message);

    // 1. Prova la cache già presente in localStorage
    const cached = getCachedXml();
    if (cached) return cached;

    // 2. Prova il file statico di default (solo al primo avvio in assoluto offline)
    const localEndpoints = [
      FALLBACK_XML_PATH,
      './public/default-schedule.xml'
    ];

    for (const url of localEndpoints) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes('<Attivita')) {
            return text;
          }
        }
      } catch (_) {}
    }

    throw remoteErr;
  }
}

/**
 * Controlla in background se ci sono aggiornamenti dell'orario SUL SERVER REMOTO.
 * Interroga il proxy Cloudflare: se questo è offline o risponde con errore,
 * segnala l'errore al badge tramite onError anziché mascherarlo con la cache locale.
 */
export async function checkBackgroundUpdate({ onUpdateAvailable, onNoChange, onError } = {}) {
  try {
    const currentHash = getCachedXmlHash();
    const remoteXml = await fetchRemoteScheduleXml();

    if (!remoteXml || typeof remoteXml !== 'string') {
      if (onNoChange) onNoChange();
      return;
    }

    const newHash = computeStringHash(remoteXml);

    if (newHash !== currentHash) {
      console.log('🔄 [Background Sync] Rilevata nuova versione dell\'orario!');
      if (onUpdateAvailable) {
        onUpdateAvailable({ newXml: remoteXml, newHash });
      }
    } else {
      console.log('✅ [Background Sync] Orario in cache già aggiornato alla versione remota.');
      if (onNoChange) onNoChange();
    }
  } catch (err) {
    console.warn('⚠️ [Background Sync] Errore verifica orario remoto:', err.message);
    if (onError) onError(err);
  }
}
