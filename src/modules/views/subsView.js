/**
 * Dashboard Sostituzioni:
 * Pannello rapido per individuare i docenti a DISPOSIZIONE per un giorno e un'ora specifici.
 */

import { getCurrentDayName, getCurrentScheduleState } from '../time.js';
import { renderLocationBadge } from './badges.js';

export function renderSubsDashboard({
  container,
  dataset,
  selectedDay,
  selectedSlotIndex,
  onDayChange,
  onSlotChange,
  onTeacherClick
}) {
  const realCurrentDay = getCurrentDayName();
  const timeState = getCurrentScheduleState(dataset.timeSlots);

  // Default day: oggi (se giorno scolastico) oppure primo giorno (Lunedì)
  const day = selectedDay || (dataset.days.includes(realCurrentDay) ? realCurrentDay : dataset.days[0]);

  // Default slot: ora corrente se attiva, altrimenti 1ª ora
  const slotIdx = selectedSlotIndex || (timeState.currentSlotIndex || 1);

  // Recupera docenti a disposizione per giorno e slot
  const subsMap = dataset.substitutions[day] || {};
  const availableTeachers = subsMap[slotIdx] || [];

  const currentSlotObj = dataset.timeSlots.find(s => s.index === slotIdx) || dataset.timeSlots[0];

  container.innerHTML = `
    <!-- Header Dashboard Compatto su Riga Singola -->
    <div class="active-view-banner">
      <div class="banner-title-group">
        <h1 class="banner-entity-name">Sostituzioni</h1>
      </div>
    </div>

    <div class="subs-dashboard">
      <!-- Card Filtri: Giorno e Ora -->
      <div class="subs-filters-card">
        <div class="day-pills-row" id="subsDayPills">
          ${dataset.days.map(d => {
            const isActive = d === day;
            const isToday = d === realCurrentDay;
            return `
              <button class="day-pill-btn ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}" data-day="${d}">
                <span class="day-short">${d.substring(0, 3)}</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="slot-pills-grid" id="subsSlotGrid">
          ${dataset.timeSlots.map(s => {
            const isActive = s.index === slotIdx;
            const isNow = (day === realCurrentDay && s.index === timeState.currentSlotIndex);
            // Conta docenti per questo slot
            const count = (subsMap[s.index] || []).length;
            return `
              <button class="slot-filter-btn ${isActive ? 'active' : ''}" data-slot="${s.index}">
                <div style="font-weight: 800; font-size: 0.9rem;">${s.index}ª ora</div>
                <div style="font-size: 0.7rem; opacity: 0.85;">${s.oInizio.replace('h', ':')}</div>
                <div style="font-size: 0.68rem; margin-top: 2px; color: ${count > 0 ? '#10b981' : 'var(--text-muted)'}; font-weight: 700;">
                  ${count} doc.
                </div>
                ${isNow ? `<span style="font-size: 0.6rem; background: var(--accent-primary); color: white; border-radius: 4px; padding: 1px 4px; margin-top: 2px;">ORA</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Elenco Docenti a Disposizione -->
      <div class="subs-results-counter">
        <span style="font-weight: 600;">Docenti in servizio a disposizione</span>
        <span style="font-weight: 700; color: var(--badge-disposizione-text);">${availableTeachers.length} trovati</span>
      </div>

      <div class="subs-teachers-list">
        ${availableTeachers.length === 0 ? `
          <div class="state-container" style="padding: 32px 16px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
            <div class="state-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="state-title">Nessun docente a disposizione</div>
            <div class="state-desc">Nessun docente ha segnato ora buca o disposizione per questo specifico orario. Prova a selezionare un'altra ora o un altro giorno.</div>
          </div>
        ` : availableTeachers.map((act, i) => `
          <div class="subs-teacher-card">
            <div class="subs-teacher-info">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">${i + 1}.</span>
                <span class="subs-teacher-name">${act.teacherDisplayName}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-left: 18px;">
                <span style="font-size: 0.78rem; color: var(--text-muted);">
                  Sede indicata: <strong>${act.sede || 'Centrale'}</strong>
                </span>
                ${renderLocationBadge(act.sede, act.aula)}
              </div>
            </div>

            <button class="btn-secondary teacher-goto-btn" data-teacher-id="${act.teacherId}" style="padding: 8px 14px; font-size: 0.8rem; white-space: nowrap;">
              Vedi Orario
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Listener cambio giorno
  container.querySelectorAll('#subsDayPills .day-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.getAttribute('data-day');
      if (onDayChange) onDayChange(d);
    });
  });

  // Listener cambio slot
  container.querySelectorAll('#subsSlotGrid .slot-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = parseInt(btn.getAttribute('data-slot'), 10);
      if (onSlotChange) onSlotChange(s);
    });
  });

  // Listener click su orario docente
  container.querySelectorAll('.teacher-goto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tId = btn.getAttribute('data-teacher-id');
      if (onTeacherClick) onTeacherClick(tId);
    });
  });
}
