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
  // Docente predefinito: primo docente o selezionato
  const teacherId = selectedTeacherId || (dataset.teachers.length > 0 ? dataset.teachers[0].id : '');
  const status = getTeacherLiveStatus(dataset, teacherId);

  container.innerHTML = `
    <!-- Header Banner Radar -->
    <div class="active-view-banner" style="background: linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, transparent 100%);">
      <div class="banner-entity-info">
        <span class="banner-type-badge" style="color: #10b981;">🛰️ Live Tracker</span>
        <h1 class="banner-entity-name">Radar Colleghi</h1>
        <span style="font-size: 0.82rem; color: var(--text-muted);">
          Individua all'istante la posizione e l'attività in corso dei docenti
        </span>
      </div>
    </div>

    <div class="radar-container">
      <!-- Selettore Docente -->
      <div class="radar-search-card">
        <label class="form-label" style="display: flex; align-items: center; justify-content: space-between;">
          <span>Cerca Docente per il Radar:</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${dataset.teachers.length} docenti</span>
        </label>
        
        <div style="position: relative;">
          <input 
            type="text" 
            id="radarTeacherSearchInput" 
            class="form-input" 
            placeholder="Digita cognome docente (es. Aragno, Rossi...)"
            value="${status.teacher.displayName}"
            autocomplete="off"
          >
          <div id="radarTeacherDropdown" class="search-results-dropdown" style="top: calc(100% + 4px); left: 0; right: 0;"></div>
        </div>

        <!-- Scorciatoie docenti rapidi -->
        <div style="display: flex; gap: 6px; overflow-x: auto; padding-top: 4px; scrollbar-width: none;">
          ${dataset.teachers.slice(0, 6).map(t => `
            <button class="quick-pill ${t.id === teacherId ? 'active' : ''} radar-quick-tch" data-id="${t.id}">
              ${t.cognome}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Live Card Stato Attuale -->
      <div class="radar-status-card ${status.badgeClass}" id="radarLiveStatusCard">
        <div class="radar-header-row">
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">
              Docente Selezionato
            </div>
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
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
            ${status.description}
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            ${status.subtext}
          </div>
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
              <span class="radar-detail-label">Aula / Luogo</span>
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
              <span class="radar-detail-label">Sede Attesa</span>
              <span class="radar-detail-value">${status.sede || 'Sede Centrale'}</span>
            </div>
          </div>
        ` : ''}

        <!-- Azioni Rapide per Docente -->
        <div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
          <button id="radarViewScheduleBtn" class="btn-primary" style="flex: 2; padding: 10px 16px; font-size: 0.85rem;">
            📅 Vedi Orario Completo
          </button>
          <button id="radarShareBtn" class="btn-secondary" style="flex: 1; padding: 10px 14px; font-size: 0.85rem;" title="Condividi posizione live">
            🔗 Condividi
          </button>
        </div>
      </div>
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

  // Click bottoni rapidi
  container.querySelectorAll('.radar-quick-tch').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (onTeacherSelect) onTeacherSelect(id);
    });
  });

  // Click su "Vedi Orario Completo"
  const viewSchedBtn = container.querySelector('#radarViewScheduleBtn');
  if (viewSchedBtn) {
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
