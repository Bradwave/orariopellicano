/**
 * Componente per la Barra di Ricerca Unificata (Spotlight UI).
 * Riconosce automaticamente classi, docenti e materie con autocompletamento in tempo reale.
 */

import { cleanSubjectName } from '../colors.js';

export function setupUnifiedSearch({
  container,
  dataset,
  onSelect,
  activeQuery = ''
}) {
  const searchInput = container.querySelector('#unifiedSearchInput');
  const clearBtn = container.querySelector('#searchClearBtn');
  const dropdown = container.querySelector('#searchResultsDropdown');
  let selectedIndex = -1;
  let currentItems = [];

  function filterItems(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matchedClasses = [];
    const matchedTeachers = [];
    const matchedSubjects = [];

    // Cerca Classi
    for (const cls of dataset.classes) {
      const short = (cls.short || '').toLowerCase();
      const full = (cls.full || '').toLowerCase();
      const display = (cls.displayShort || cls.short || '').toLowerCase();
      
      const aliases = [
        short,
        full,
        display,
        short.replace('alfa', 'a'),
        short.replace('alfa', 'alpha'),
        short.replace('alfa', 'α'),
        short.replace('beta', 'β'),
        short.replace('gamma', 'γ')
      ];

      if (aliases.some(a => a.includes(q)) || q.includes(short) || q === display) {
        matchedClasses.push({
          type: 'class',
          id: cls.short,
          title: (cls.displayShort && cls.displayShort !== cls.short)
            ? `${cls.displayShort} (${cls.short})`
            : (cls.displayShort || cls.short),
          subtitle: cls.full,
          badgeText: 'Classe',
          badgeClass: 'badge-class'
        });
        if (matchedClasses.length >= 5) break;
      }
    }

    // Cerca Docenti
    for (const tch of dataset.teachers) {
      if (tch.cognome.toLowerCase().includes(q) || tch.displayName.toLowerCase().includes(q)) {
        matchedTeachers.push({
          type: 'teacher',
          id: tch.id,
          title: tch.displayName,
          subtitle: 'Docente',
          badgeText: 'Docente',
          badgeClass: 'badge-teacher'
        });
        if (matchedTeachers.length >= 6) break;
      }
    }

    // Cerca Materie
    for (const sub of dataset.subjects) {
      const cleanName = cleanSubjectName(sub.name || sub.code);
      if (
        sub.code.toLowerCase().includes(q) ||
        (sub.name && sub.name.toLowerCase().includes(q)) ||
        cleanName.toLowerCase().includes(q)
      ) {
        matchedSubjects.push({
          type: 'subject',
          id: sub.code,
          title: cleanName,
          subtitle: `Cod. ${sub.code}`,
          badgeText: 'Materia',
          badgeClass: 'badge-subject'
        });
        if (matchedSubjects.length >= 4) break;
      }
    }

    return [
      ...matchedClasses,
      ...matchedTeachers,
      ...matchedSubjects
    ];
  }

  function renderDropdown(items) {
    currentItems = items;
    selectedIndex = -1;

    if (items.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
          Nessuna classe, docente o materia corrispondente.
        </div>
      `;
      dropdown.classList.add('open');
      return;
    }

    // Raggruppa per tipo
    const classes = items.filter(i => i.type === 'class');
    const teachers = items.filter(i => i.type === 'teacher');
    const subjects = items.filter(i => i.type === 'subject');

    let html = '';

    if (classes.length > 0) {
      html += `<div class="search-group-header"><span class="material-symbols-outlined" style="font-size: 16px;">school</span> Classi</div>`;
      classes.forEach((item, idx) => {
        html += renderSearchItem(item, idx);
      });
    }

    if (teachers.length > 0) {
      html += `<div class="search-group-header"><span class="material-symbols-outlined" style="font-size: 16px;">person</span> Docenti</div>`;
      teachers.forEach((item, idx) => {
        const globalIdx = classes.length + idx;
        html += renderSearchItem(item, globalIdx);
      });
    }

    if (subjects.length > 0) {
      html += `<div class="search-group-header"><span class="material-symbols-outlined" style="font-size: 16px;">menu_book</span> Materie</div>`;
      subjects.forEach((item, idx) => {
        const globalIdx = classes.length + teachers.length + idx;
        html += renderSearchItem(item, globalIdx);
      });
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('open');

    // Event listeners su click
    const domItems = dropdown.querySelectorAll('.search-item');
    domItems.forEach((el, idx) => {
      el.addEventListener('click', () => {
        handleSelectItem(currentItems[idx]);
      });
    });
  }

  function renderSearchItem(item, globalIdx) {
    return `
      <div class="search-item" data-index="${globalIdx}">
        <div class="search-item-left">
          <span class="search-item-badge ${item.badgeClass}">${item.badgeText}</span>
          <div>
            <div class="search-item-title">${item.title}</div>
            <div class="search-item-subtitle">${item.subtitle}</div>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `;
  }

  function handleSelectItem(item) {
    dropdown.classList.remove('open');
    searchInput.value = item.title;
    clearBtn.classList.add('visible');
    if (onSelect) onSelect(item);
  }

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.trim()) {
      clearBtn.classList.add('visible');
      const items = filterItems(val);
      renderDropdown(items);
    } else {
      clearBtn.classList.remove('visible');
      dropdown.classList.remove('open');
    }
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      const items = filterItems(searchInput.value);
      renderDropdown(items);
    }
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.remove('visible');
    dropdown.classList.remove('open');
    searchInput.focus();
  });

  // Chiusura al click esterno
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Navigazione da tastiera
  searchInput.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('open') || currentItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % currentItems.length;
      updateHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
      updateHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < currentItems.length) {
        handleSelectItem(currentItems[selectedIndex]);
      } else if (currentItems.length > 0) {
        handleSelectItem(currentItems[0]);
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
    }
  });

  function updateHighlight() {
    const domItems = dropdown.querySelectorAll('.search-item');
    domItems.forEach((el, idx) => {
      if (idx === selectedIndex) {
        el.classList.add('highlighted');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('highlighted');
      }
    });
  }

  return {
    setQuery(text) {
      searchInput.value = text;
      if (text) clearBtn.classList.add('visible');
      else clearBtn.classList.remove('visible');
    },
    closeDropdown() {
      dropdown.classList.remove('open');
    }
  };
}
