/**
 * Modulo per la condivisione nativa (Web Share API) e generazione di deep-link.
 */

/**
 * Genera un URL assoluto con parametri di routing nativo per l'entità specificata.
 */
export function generateDeepLink(type, id) {
  const url = new URL(window.location.href);
  // Pulisci vecchi parametri di navigazione
  url.searchParams.delete('classe');
  url.searchParams.delete('docente');
  url.searchParams.delete('materia');
  url.searchParams.delete('radar');

  if (type === 'class') {
    url.searchParams.set('classe', id);
  } else if (type === 'teacher') {
    url.searchParams.set('docente', id);
  } else if (type === 'subject') {
    url.searchParams.set('materia', id);
  } else if (type === 'radar') {
    url.searchParams.set('radar', id);
  }

  return url.toString();
}

/**
 * Condivide l'orario tramite Web Share API o copia negli appunti.
 * @param {object} params - { title, text, type, id }
 * @returns {Promise<object>} { success, method: 'native' | 'clipboard' }
 */
export async function shareSchedule({ title, text, type, id }) {
  const shareUrl = generateDeepLink(type, id);
  const shareData = {
    title: title || 'Orario Scolastico • Orario Pellicano',
    text: text || `Consulta l'orario scolastico per ${title}`,
    url: shareUrl
  };

  // 1. Prova Web Share API nativa
  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return { success: true, method: 'native', url: shareUrl };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, aborted: true };
      }
      console.warn('Web Share API non completata, fallback su clipboard:', err);
    }
  }

  // 2. Fallback: copia negli appunti
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      return { success: true, method: 'clipboard', url: shareUrl };
    } else {
      // Fallback per browser datati
      const input = document.createElement('textarea');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      return { success: true, method: 'clipboard', url: shareUrl };
    }
  } catch (clipErr) {
    console.error('Errore copia negli appunti:', clipErr);
    return { success: false, error: clipErr.message, url: shareUrl };
  }
}
