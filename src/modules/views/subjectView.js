/**
 * Vista Materia: vista trasversale per vedere in quali classi, giorni e orari viene insegnata la materia.
 */

import { renderLocationBadge } from './badges.js';
import { getSubjectColor, cleanSubjectName } from '../colors.js';
import { formatClassDisplayName } from '../parser.js';

export function renderSubjectView({
  container,
  dataset,
  subjectCode,
  onClassClick,
  onTeacherClick
}) {
  const subject = dataset.subjects.find(s => s.code === subjectCode) || { code: subjectCode, name: subjectCode };
  const activities = dataset.bySubject[subjectCode] || [];
  const subjectColor = getSubjectColor(subject.name, subject.code);
  const cleanName = cleanSubjectName(subject.name || subject.code);

  // Raccogli docenti e classi coinvolte
  const teachersSet = new Map();
  const classesSet = new Set();
  activities.forEach(a => {
    if (a.teacherId) teachersSet.set(a.teacherId, a.teacherDisplayName);
    if (a.classeShort) classesSet.add(a.classeShort);
  });

  const sortedClasses = Array.from(classesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sortedTeachers = Array.from(teachersSet.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  // Raggruppa per giorno
  const byDay = {};
  dataset.days.forEach(d => { byDay[d] = []; });
  activities.forEach(a => {
    if (!a.isContinuation) {
      if (!byDay[a.giorno]) byDay[a.giorno] = [];
      byDay[a.giorno].push(a);
    }
  });

  container.innerHTML = `
    <!-- Active Entity Banner Compatto -->
    <div class="active-view-banner" style="border-left: 4px solid ${subjectColor.color};">
      <div class="banner-entity-info-compact">
        <h1 class="banner-entity-name">${cleanName}</h1>
        <span class="banner-meta-chip">
          ${subject.code} · ${sortedClasses.length} classi · ${sortedTeachers.length} docenti
        </span>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div style="padding: 16px 16px 8px 16px; display: flex; flex-direction: column; gap: 12px;">
      <!-- Docenti che insegnano la materia -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px 16px;">
        <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 16px;">person</span>
          Docenti del dipartimento (${sortedTeachers.length})
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${sortedTeachers.map(([tId, tName]) => `
            <span class="teacher-chip" data-teacher-id="${tId}" title="Vedi orario docente">
              <span class="material-symbols-outlined" style="font-size: 14px;">person</span>
              ${tName}
            </span>
          `).join('')}
        </div>
      </div>

      <!-- Classi coinvolte -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px 16px;">
        <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 16px;">school</span>
          Classi (${sortedClasses.length})
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${sortedClasses.map(cls => `
            <span class="class-chip" data-class-name="${cls}" title="Vedi orario classe">
              <span class="material-symbols-outlined" style="font-size: 14px;">school</span>
              ${formatClassDisplayName(cls)}
            </span>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Elenco lezioni settimanali per giorno -->
    <div class="schedule-list" style="padding-top: 8px;">
      <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
        Calendario lezioni settimanali:
      </div>
      ${dataset.days.map(day => {
        const dayActs = byDay[day] || [];
        if (dayActs.length === 0) return '';
        dayActs.sort((a, b) => a.startMinutes - b.startMinutes);

        return `
          <div style="margin-bottom: 12px;">
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--accent-primary); text-transform: capitalize; padding: 4px 0; border-bottom: 1px solid var(--border-subtle); margin-bottom: 8px;">
              ${day} (${dayActs.length} ore)
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${dayActs.map(act => `
                <div class="hour-card" style="padding: 12px 14px; border-left: 3px solid ${subjectColor.color};">
                  <div class="hour-card-header">
                    <div class="hour-slot-badge">
                      <span class="slot-number">${act.slotIndex}ª ora</span>
                      <span class="slot-time">${act.slot ? act.slot.timeFormatted : act.oInizio}</span>
                    </div>
                    <span class="class-chip" data-class-name="${act.classeShort}">
                      <span class="material-symbols-outlined" style="font-size: 14px;">school</span>
                      Classe ${act.classeDisplayShort || formatClassDisplayName(act.classeShort)}
                    </span>
                  </div>
                  <div class="hour-card-footer" style="padding-top: 6px; border: none;">
                    <span class="teacher-chip" data-teacher-id="${act.teacherId}">
                      <span class="material-symbols-outlined" style="font-size: 14px;">person</span>
                      ${act.teacherDisplayName}
                    </span>
                    <div class="badges-group">
                      ${renderLocationBadge(act.sede, act.aula)}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Listeners
  container.querySelectorAll('.class-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cls = chip.getAttribute('data-class-name');
      if (onClassClick) onClassClick(cls);
    });
  });

  container.querySelectorAll('.teacher-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tId = chip.getAttribute('data-teacher-id');
      if (onTeacherClick) onTeacherClick(tId);
    });
  });
}
