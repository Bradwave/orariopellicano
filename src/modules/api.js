/**
 * Modulo di rete per il recupero dell'orario XML e gestione intelligente degli aggiornamenti.
 */

import {
  getProxyUrl,
  getCachedXml,
  getCachedXmlHash,
  saveXmlCache,
  computeStringHash
} from './storage.js';

export const FALLBACK_XML_PATH = './default-schedule.xml';

/**
 * Esegue il fetch dell'XML da un endpoint remoto o fallback locale.
 */
export async function fetchScheduleXml(targetUrl = null) {
  const url = targetUrl || getProxyUrl();

  // Se l'URL contiene ancora il segnaposto di default non configurato, usa il dataset locale
  if (url.includes('[inserisci-qui-il-tuo-account]')) {
    try {
      const res = await fetch(FALLBACK_XML_PATH, { cache: 'no-cache' });
      if (res.ok) return await res.text();
    } catch (e) {}
    const res2 = await fetch('./public/default-schedule.xml', { cache: 'no-cache' });
    if (!res2.ok) throw new Error('Impossibile caricare il file XML di default.');
    return await res2.text();
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });

    if (!res.ok) {
      throw new Error(`Worker Proxy HTTP ${res.status}: ${res.statusText}`);
    }

    const xmlText = await res.text();
    return xmlText;
  } catch (err) {
    console.warn(`Fetch da proxy fallita (${url}), tentativo fallback locale:`, err);
    // Fallback a file XML statico locale
    try {
      const fallbackRes = await fetch(FALLBACK_XML_PATH, { cache: 'no-cache' });
      if (fallbackRes.ok) return await fallbackRes.text();
    } catch (e) {}
    const fallbackRes2 = await fetch('./public/default-schedule.xml', { cache: 'no-cache' });
    if (!fallbackRes2.ok) {
      throw new Error(`Impossibile recuperare l'orario: ${err.message}`);
    }
    return await fallbackRes2.text();
  }
}

/**
 * Avvia il controllo in background per verificare se ci sono aggiornamenti dell'orario.
 * Calcola l'hash/confronto della stringa ricevuta.
 * Se rileva una discrepanza, NON cancella né sovrascrive forzatamente lo schermo,
 * ma segnala la presenza di un aggiornamento tramite onUpdateAvailable({ newXml, newHash }).
 *
 * @param {object} callbacks - { onUpdateAvailable, onNoChange, onError }
 */
export async function checkBackgroundUpdate({ onUpdateAvailable, onNoChange, onError } = {}) {
  try {
    const currentHash = getCachedXmlHash();
    const fetchedXml = await fetchScheduleXml();

    if (!fetchedXml || typeof fetchedXml !== 'string') {
      if (onNoChange) onNoChange();
      return;
    }

    const newHash = computeStringHash(fetchedXml);

    if (newHash !== currentHash) {
      console.log('🔄 [Background Sync] Rilevata discrepanza tra orario remoto e cache locale!');
      if (onUpdateAvailable) {
        onUpdateAvailable({ newXml: fetchedXml, newHash });
      }
    } else {
      console.log('✅ [Background Sync] Orario in cache già identico alla versione remota.');
      if (onNoChange) onNoChange();
    }
  } catch (err) {
    console.warn('⚠️ [Background Sync] Errore durante il controllo in background:', err);
    if (onError) onError(err);
  }
}
