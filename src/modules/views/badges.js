/**
 * Helper per la generazione dei badge cromatici per sedi, aule e caratteristiche delle lezioni.
 */

export function renderLocationBadge(sede = '', aula = '') {
  const cleanSede = (sede || '').trim();
  const cleanAula = (aula || '').trim();

  const badges = [];

  // Verifica Palestra
  if (cleanAula.toUpperCase().includes('PALESTRA') || cleanSede.toUpperCase().includes('PALESTRA')) {
    badges.push(`
      <span class="badge badge-palestra" title="Lezione in Palestra">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>
        Palestra
      </span>
    `);
  }

  // Verifica Succursale (es. SuccD'Azeglio)
  if (cleanSede.toUpperCase().includes('SUCC')) {
    badges.push(`
      <span class="badge badge-succursale" title="Spostamento in Succursale">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
        ${cleanSede}
      </span>
    `);
  } else if (cleanSede && !cleanSede.toUpperCase().includes('DISPOSIZIONE')) {
    // Sede Centrale ordinaria
    badges.push(`
      <span class="badge badge-sede" title="Sede Centrale">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>
        ${cleanSede}
      </span>
    `);
  }

  // Aula specifica se presente e non generica
  if (cleanAula && !cleanAula.includes('<') && !cleanAula.toUpperCase().includes('PALESTRA') && !cleanAula.toUpperCase().includes('DISPOSIZIONE')) {
    badges.push(`
      <span class="badge badge-sede" title="Aula ${cleanAula}">
        Aula ${cleanAula}
      </span>
    `);
  }

  return badges.join('');
}

export function renderCoDocenzaBadge(coDocenti = []) {
  if (!coDocenti || coDocenti.length === 0) return '';
  return `
    <span class="badge badge-codocenza" title="Lezione in Co-Docenza">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Co-Docenza
    </span>
  `;
}
