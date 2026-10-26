// @ts-check
import { placeMode } from './contact.js';

/**
 * @typedef {import('./contact.js').ContactData} ContactData
 * @typedef {Record<'intro' | 'name' | 'phone' | 'date' | 'state' | 'country' | 'municipality' | 'alcaldia' | 'city' | 'locality' | 'eventType' | 'vaqueria' | 'privado' | 'message', string>} MessageText
 */

const LONG_DATE = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * "2026-12-12" → "sábado, 12 de diciembre de 2026". Se interpreta en UTC para que la zona
 * horaria del navegador no mueva el día.
 * @param {string} iso
 */
export function formatLongDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return LONG_DATE.format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Texto del mensaje de WhatsApp (CON-7). Los datos ya deben venir validados y sin espacios
 * sobrantes (`trimContact`).
 * @param {ContactData} data
 * @param {MessageText} t textos de `ui.contact.message`
 * @param {string} capital nombre de la Ciudad de México en la lista de estados
 * @returns {string}
 */
export function buildMessage(data, t, capital) {
  const mode = placeMode(data.state, capital);
  const lines = [
    t.intro,
    '',
    `${t.name}: ${data.name}`,
    `${t.phone}: ${data.phone}`,
    `${t.date}: ${formatLongDate(data.date)}`,
  ];
  if (mode === 'abroad') {
    lines.push(`${t.country}: ${data.country}`, `${t.city}: ${data.municipality}`);
  } else {
    const label = mode === 'capital' ? t.alcaldia : t.municipality;
    lines.push(`${t.state}: ${data.state}`, `${label}: ${data.municipality}`);
  }
  if (data.locality) lines.push(`${t.locality}: ${data.locality}`);
  const type =
    data.eventType === 'privado'
      ? `${t.privado}${data.detail ? ` (${data.detail})` : ''}`
      : t.vaqueria;
  lines.push(`${t.eventType}: ${type}`);
  if (data.message) lines.push(`${t.message}: ${data.message}`);
  return lines.join('\n');
}

/**
 * Enlace que abre WhatsApp con el mensaje listo. No pasa por ningún servidor propio.
 * @param {string} number con lada de país y sin signos, p. ej. "529995893559"
 * @param {string} text
 */
export function waUrl(number, text) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
