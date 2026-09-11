/**
 * Vista Radar Colleghi (Live Tracker Docenti).
 * Permette di selezionare qualsiasi docente e sapere immediatamente in quale classe,
 * aula o sede si trovi in questo preciso minuto.
 */

import { getTeacherLiveStatus } from '../radar.js';
import { renderLocationBadge } from './badges.js';
import { shareSchedule } from '../share.js';

export function renderRadarView({
  container,
  dataset,
  selectedTeacherId = null,
  onTeacherSelect,
  onViewFullSchedule,
  onShowToast
}) {
  // Docente selezionato: usa quello passato (ad es. da teacherView) oppure avvio neutro (null)
  const teacherId = selectedTeacherId || null;
  const status = teacherId ? getTeacherLiveStatus(dataset, teacherId) : null;

  container.innerHTML = `
    <!-- Header Banner Radar Compatto su Riga Singola -->
    <div class="active-view-banner">
      <div class="banner-title-group">
        <h1 class="banner-entity-name">Radar Colleghi</h1>
      </div>
    </div>

    <div class="radar-container">
      <!-- Selettore Docente -->
      <div class="radar-search-card">
        <label class="form-label" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span>Cerca dove si trova il docente</span>
        </label>
        
        <div style="position: relative;">
          <input 
            type="text" 
            id="radarTeacherSearchInput" 
            class="form-input" 
            placeholder="Digita cognome docente (es. Aragno, Rossi...)"
            value="${status ? status.teacher.displayName : ''}"
            autocomplete="off"
          >
          <div id="radarTeacherDropdown" class="search-results-dropdown" style="top: calc(100% + 4px); left: 0; right: 0;"></div>
        </div>
      </div>

      <!-- Live Card Stato Attuale oppure Segnaposto Neutro -->
      ${status ? `
        <div class="radar-status-card ${status.badgeClass}" id="radarLiveStatusCard">
          <div class="radar-header-row">
            <div>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary);">
                ${status.teacher.displayName}
              </div>
            </div>
            
            <div class="radar-live-badge">
              <span class="pulse-dot-live"></span>
              ${status.title}
            </div>
          </div>

          <div>
            <div style="font-size: 1.1rem; font-weight: 700; color: ${status.isOffSchool ? 'var(--text-muted)' : 'var(--text-primary)'}; margin-bottom: 4px;">
              ${status.description}
            </div>
            ${status.subtext ? `
              <div style="font-size: 0.85rem; color: var(--text-secondary);">
                ${status.subtext}
              </div>
            ` : ''}
          </div>

          ${status.statusCode === 'in_service' ? `
            <div class="radar-details-grid">
              <div class="radar-detail-box">
                <span class="radar-detail-label">Classe</span>
                <span class="radar-detail-value" style="color: var(--accent-primary);">
                  ${status.classe || 'N/D'}
                </span>
              </div>
              <div class="radar-detail-box">
                <span class="radar-detail-label">Aula / luogo</span>
                <span class="radar-detail-value">
                  ${status.aula ? 'Aula ' + status.aula : 'Sede'}
                </span>
              </div>
              <div class="radar-detail-box">
                <span class="radar-detail-label">Materia</span>
                <span class="radar-detail-value" style="font-size: 0.82rem;">
                  ${status.materia}
                </span>
              </div>
              <div class="radar-detail-box">
                <span class="radar-detail-label">Sede</span>
                <span class="radar-detail-value" style="font-size: 0.82rem;">
                  ${status.sede || 'Centrale'}
                </span>
              </div>
            </div>
          ` : ''}

          ${status.statusCode === 'disposizione' ? `
            <div class="radar-details-grid">
              <div class="radar-detail-box">
                <span class="radar-detail-label">Stato</span>
                <span class="radar-detail-value" style="color: #fbbf24;">Disponibile per supplenze</span>
              </div>
              <div class="radar-detail-box">
                <span class="radar-detail-label">Sede attesa</span>
                <span class="radar-detail-value">${status.sede || 'Sede Centrale'}</span>
              </div>
            </div>
          ` : ''}

          <!-- Azioni rapide per docente -->
          <div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
            <button id="radarViewScheduleBtn" class="btn-primary" style="flex: 2; padding: 10px 16px; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
              <span class="material-symbols-outlined" style="font-size: 18px;">calendar_month</span>
              Vedi orario completo
            </button>
            <button id="radarShareBtn" class="btn-secondary" style="flex: 1; padding: 10px 14px; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; gap: 6px;" title="Condividi posizione live">
              <span class="material-symbols-outlined" style="font-size: 18px;">share</span>
              Condividi
            </button>
          </div>
        </div>
      ` : `
        <div class="state-container" style="padding: 36px 16px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle); margin-top: 8px;">
          <div class="state-icon" style="background: rgba(20, 184, 166, 0.08); color: var(--accent-primary);">
            <span class="material-symbols-outlined" style="font-size: 28px;">radar</span>
          </div>
          <div class="state-title" style="font-size: 0.95rem; margin-top: 8px;">Nessun docente selezionato</div>
          <div class="state-desc" style="font-size: 0.8rem; color: var(--text-muted); max-width: 320px; margin: 4px auto 0;">Cerca un docente nella barra in alto per visualizzarne la posizione attuale e l'attività in corso.</div>
        </div>
      `}
    </div>
  `;

  // Autocomplete ricerca docente
  const searchInput = container.querySelector('#radarTeacherSearchInput');
  const dropdown = container.querySelector('#radarTeacherDropdown');

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      dropdown.classList.remove('open');
      return;
    }

    const matches = dataset.teachers.filter(t => 
      t.cognome.toLowerCase().includes(q) || t.displayName.toLowerCase().includes(q)
    ).slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = `<div style="padding: 12px; font-size: 0.82rem; color: var(--text-muted); text-align: center;">Nessun docente trovato</div>`;
      dropdown.classList.add('open');
      return;
    }

    dropdown.innerHTML = matches.map(m => `
      <div class="search-item radar-search-item" data-id="${m.id}">
        <div class="search-item-left">
          <span class="search-item-badge badge-teacher">Docente</span>
          <div class="search-item-title">${m.displayName}</div>
        </div>
      </div>
    `).join('');
    dropdown.classList.add('open');

    dropdown.querySelectorAll('.radar-search-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        dropdown.classList.remove('open');
        if (onTeacherSelect) onTeacherSelect(id);
      });
    });
  });

  searchInput.addEventListener('focus', () => {
    searchInput.select();
  });

  // Click su "Vedi Orario Completo"
  const viewSchedBtn = container.querySelector('#radarViewScheduleBtn');
  if (viewSchedBtn && status) {
    viewSchedBtn.addEventListener('click', () => {
      if (onViewFullSchedule) onViewFullSchedule(status.teacher.id);
    });
  }

  // Click su "Condividi"
  const shareBtn = container.querySelector('#radarShareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const res = await shareSchedule({
        title: `Radar: ${status.teacher.displayName}`,
        text: `Stato live: ${status.title} (${status.description})`,
        type: 'radar',
        id: status.teacher.id
      });
      if (res.success && res.method === 'clipboard' && onShowToast) {
        onShowToast('Link al Radar copiato negli appunti!', 'success');
      }
    });
  }

  // Chiusura dropdown al click esterno
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}
