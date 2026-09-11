/**
 * Modulo per l'esportazione dell'orario scolastico:
 * 1. Testo formattato per appunti / messaggistica (WhatsApp, Telegram, email)
 * 2. Immagine PNG ad alta risoluzione (Canvas 2D Retina) scaricabile
 */

import { cleanSubjectName, getSubjectColor, getGridSubjectName } from './colors.js';
import { getTheme } from './storage.js';

/**
 * Copia l'orario completo formattato come testo leggibile negli appunti.
 * @param {object} params - { title, type, scheduleData, timeSlots, days }
 * @returns {Promise<boolean>}
 */
export async function copyScheduleAsText({ title, type, scheduleData, timeSlots, days }) {
  if (!scheduleData || !timeSlots || !days) return false;

  let text = `📅 ORARIO SCOLASTICO: ${title.toUpperCase()}\n`;
  text += `Liceo Statale Pellicano\n`;
  text += `----------------------------------------\n\n`;

  days.forEach((day) => {
    const daySchedule = scheduleData[day] || {};
    const activeSlots = timeSlots.filter(s => (daySchedule[s.index] || []).length > 0);

    if (activeSlots.length === 0) {
      text += `📌 ${day.toUpperCase()}: Nessun impegno scolastico\n\n`;
      return;
    }

    text += `📌 ${day.toUpperCase()}:\n`;

    const skippedSlots = new Set();
    activeSlots.forEach((slot) => {
      if (skippedSlots.has(slot.index)) return;

      const acts = daySchedule[slot.index] || [];
      const nonContinuation = acts.filter(a => !a.isContinuation);
      const act = nonContinuation[0] || acts[0];
      if (!act) return;

      const span = Math.max(1, act.durataHours || 1);
      if (span > 1) {
        for (let s = 1; s < span; s++) {
          skippedSlots.add(slot.index + s);
        }
      }

      const endSlot = timeSlots.find(s => s.index === slot.index + span - 1) || slot;
      const slotLabel = span > 1 ? `${slot.index}ª-${endSlot.index}ª ora` : `${slot.index}ª ora`;
      const timeLabel = `${slot.startTimeFormatted || slot.oInizio.replace('h', ':')} - ${endSlot.endTimeFormatted || ''}`.trim();

      if (act.isDisposizione) {
        text += `  • ${slotLabel} (${timeLabel}): Disposizione per sostituzioni\n`;
      } else {
        const mat = cleanSubjectName(act.matNome || act.matCod);
        const who = type === 'class'
          ? (act.teacherDisplayName ? `[${act.teacherDisplayName}]` : '')
          : (act.classeShort ? `[${act.classeShort}]` : '');
        const where = [
          act.aula ? `Aula ${act.aula.replace(/[<>]/g, '')}` : '',
          (act.sede && act.sede !== 'DISPOSIZIONE') ? act.sede : ''
        ].filter(Boolean).join(' - ');

        const details = [who, where ? `(${where})` : ''].filter(Boolean).join(' ');
        text += `  • ${slotLabel} (${timeLabel}): ${mat}${details ? ' ' + details : ''}\n`;
      }
    });
    text += `\n`;
  });

  text += `Generato da Orario Pellicano • ${new Date().toLocaleDateString('it-IT')}`;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Scrittura appunti non riuscita:', err);
  }

  // Fallback con textarea
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (_) {
    return false;
  }
}

/**
 * Genera il Blob PNG dell'orario settimanale ad alta definizione (2x Retina).
 * @param {object} params - { title, type, scheduleData, timeSlots, days }
 * @returns {Promise<Blob|null>}
 */
export async function renderScheduleBlob({ title, type, scheduleData, timeSlots, days }) {
  if (!scheduleData || !timeSlots || !days) return null;

  const currentTheme = getTheme();
  const isDark = currentTheme !== 'light';

  // Configurazione grafica e colori
  const bgMain = isDark ? '#041718' : '#fdf6e3';
  const bgCard = isDark ? '#092123' : '#ffffff';
  const bgTimeCell = isDark ? '#061b1d' : '#f4eed9';
  const textPrimary = isDark ? '#e6f1f2' : '#073642';
  const textSecondary = isDark ? '#94a3b8' : '#586e75';
  const textMuted = isDark ? '#64748b' : '#93a1a1';
  const borderCol = isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(101, 123, 131, 0.2)';
  const accentCol = isDark ? '#14b8a6' : '#0f766e';

  // Dimensioni Canvas (2x per Retina)
  const scale = 2;
  const colTimeWidth = 85;
  const colDayWidth = 175;
  const headerHeight = 110;
  const dayHeaderHeight = 44;
  const rowHeight = 72;
  const paddingX = 24;
  const paddingY = 24;

  const width = paddingX * 2 + colTimeWidth + (colDayWidth * days.length);
  const height = paddingY * 2 + headerHeight + dayHeaderHeight + (rowHeight * timeSlots.length);

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 1. Sfondo generale
  ctx.fillStyle = bgMain;
  ctx.fillRect(0, 0, width, height);

  // 2. Header Grafico
  ctx.fillStyle = accentCol;
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('ORARIO SCOLASTICO SETTIMANALE', paddingX, paddingY + 18);

  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(title, paddingX, paddingY + 48);

  ctx.fillStyle = textSecondary;
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Liceo Statale Pellicano • Aggiornato il ${new Date().toLocaleDateString('it-IT')}`, paddingX, paddingY + 70);

  // Linea divisoria sotto l'header
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, paddingY + headerHeight - 15);
  ctx.lineTo(width - paddingX, paddingY + headerHeight - 15);
  ctx.stroke();

  const gridTop = paddingY + headerHeight;

  // 3. Intestazioni Giorni della Settimana
  days.forEach((day, dIdx) => {
    const x = paddingX + colTimeWidth + (dIdx * colDayWidth);
    const y = gridTop;

    ctx.fillStyle = bgCard;
    roundRect(ctx, x + 3, y, colDayWidth - 6, dayHeaderHeight - 6, 6);
    ctx.fill();
    ctx.strokeStyle = borderCol;
    ctx.stroke();

    ctx.fillStyle = textPrimary;
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(day, x + (colDayWidth / 2), y + 24);
  });

  // 4. Righe Orarie e Celle Lezioni
  timeSlots.forEach((slot, sIdx) => {
    const y = gridTop + dayHeaderHeight + (sIdx * rowHeight);

    // Cella Ora (Colonna Sinistra)
    const timeX = paddingX;
    ctx.fillStyle = bgTimeCell;
    roundRect(ctx, timeX, y + 2, colTimeWidth - 6, rowHeight - 4, 6);
    ctx.fill();
    ctx.strokeStyle = borderCol;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = textPrimary;
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${slot.index}ª ora`, timeX + ((colTimeWidth - 6) / 2), y + 24);

    ctx.fillStyle = textMuted;
    ctx.font = '10px "Space Mono", monospace, monospace';
    ctx.fillText(slot.oInizio.replace('h', ':'), timeX + ((colTimeWidth - 6) / 2), y + 42);

    // Celle per ciascun giorno
    days.forEach((day, dIdx) => {
      const cellX = paddingX + colTimeWidth + (dIdx * colDayWidth);
      const dayActs = (scheduleData[day] && scheduleData[day][slot.index]) || [];

      if (dayActs.length === 0) {
        // Cella vuota
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
        roundRect(ctx, cellX + 3, y + 2, colDayWidth - 6, rowHeight - 4, 6);
        ctx.fill();
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
        ctx.stroke();
      } else {
        const act = dayActs[0];
        const isDisp = act.isDisposizione;
        const colorObj = isDisp ? { color: '#f59e0b' } : getSubjectColor(act.matNome, act.matCod);
        const cleanName = isDisp ? 'Disposizione' : getGridSubjectName(act.matNome, act.matCod);

        // Box Lezione
        ctx.fillStyle = bgCard;
        roundRect(ctx, cellX + 3, y + 2, colDayWidth - 6, rowHeight - 4, 6);
        ctx.fill();
        ctx.strokeStyle = borderCol;
        ctx.stroke();

        // Barra colorata a sinistra
        ctx.fillStyle = colorObj.color;
        roundRect(ctx, cellX + 3, y + 2, 4, rowHeight - 4, { tl: 6, bl: 6, tr: 0, br: 0 });
        ctx.fill();

        // Testo Materia
        ctx.textAlign = 'left';
        ctx.fillStyle = textPrimary;
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        const truncatedName = truncateText(ctx, cleanName, colDayWidth - 24);
        ctx.fillText(truncatedName, cellX + 12, y + 20);

        // Sottotesto (Classe o Docente)
        let subText = '';
        if (type === 'class') {
          subText = act.docCogn ? `${act.docCogn} ${act.docNome || ''}`.trim() : (act.docente || '');
        } else {
          subText = act.classeShort || '';
        }

        if (subText && !isDisp) {
          ctx.fillStyle = textSecondary;
          ctx.font = '10px system-ui, -apple-system, sans-serif';
          ctx.fillText(truncateText(ctx, subText, colDayWidth - 24), cellX + 12, y + 36);
        }

        // Luogo / Aula
        const loc = act.aula ? `Aula ${act.aula.replace(/[<>]/g, '')}` : (act.sede || '');
        if (loc && !isDisp) {
          ctx.fillStyle = textMuted;
          ctx.font = '9px system-ui, -apple-system, sans-serif';
          ctx.fillText(truncateText(ctx, loc, colDayWidth - 24), cellX + 12, y + 52);
        }
      }
    });
  });

  // Footer Branding
  ctx.textAlign = 'right';
  ctx.fillStyle = textMuted;
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  ctx.fillText('Orario Pellicano • PWA', width - paddingX, height - 10);

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

/**
 * Genera un'immagine PNG ad alta definizione (2x Retina) dell'orario settimanale e la scarica.
 * @param {object} params - { title, type, scheduleData, timeSlots, days }
 * @returns {Promise<string>} Nome del file scaricato
 */
export async function exportScheduleAsImage({ title, type, scheduleData, timeSlots, days }) {
  const blob = await renderScheduleBlob({ title, type, scheduleData, timeSlots, days });
  if (!blob) return null;

  const filename = `Orario_${title.replace(/\s+/g, '_')}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

/**
 * Condivide direttamente l'immagine dell'orario tramite Web Share API, clipboard o download.
 * @param {object} params - { title, type, scheduleData, timeSlots, days }
 * @returns {Promise<object>} { success, method: 'share' | 'clipboard' | 'download', filename? }
 */
export async function shareScheduleImage({ title, type, scheduleData, timeSlots, days }) {
  const blob = await renderScheduleBlob({ title, type, scheduleData, timeSlots, days });
  if (!blob) return { success: false };

  const filename = `Orario_${title.replace(/\s+/g, '_')}.png`;

  // 1. Prova Web Share API con invio diretto del file immagine (Android, iOS Safari, macOS Chrome)
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Orario ${title}`,
        text: `Orario scolastico per ${title}`,
        files: [file]
      });
      return { success: true, method: 'share' };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, aborted: true };
    }
    console.warn('Condivisione file immagine non completata, provo fallback:', err);
  }

  // 2. Fallback: copia file immagine negli appunti
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return { success: true, method: 'clipboard' };
    } catch (clipErr) {
      console.warn('Copia immagine negli appunti non riuscita:', clipErr);
    }
  }

  // 3. Fallback finale: download diretto
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { success: true, method: 'download', filename };
}

/**
 * Helper per disegnare rettangoli arrotondati su Canvas 2D
 */
function roundRect(ctx, x, y, width, height, radius = 4) {
  let r = radius;
  if (typeof radius === 'number') {
    r = { tl: radius, tr: radius, br: radius, bl: radius };
  }
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + width - r.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr);
  ctx.lineTo(x + width, y + height - r.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
  ctx.lineTo(x + r.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}

/**
 * Helper per troncare il testo con ellissi se supera la larghezza
 */
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let len = text.length;
  while (len > 0 && ctx.measureText(text.substring(0, len) + '…').width > maxWidth) {
    len--;
  }
  return text.substring(0, len) + '…';
}
