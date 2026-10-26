// @ts-check
// Formatos compartidos por las plantillas (build) y el JavaScript del navegador.

/**
 * Número con dos cifras: 1 → "01".
 * @param {number} n
 */
export const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Duración de una pista: 155 → "2:35"; 3725 → "1:02:05".
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = pad2(total % 60);
  return h ? `${h}:${pad2(m)}:${s}` : `${m}:${s}`;
}

/**
 * Duración en formato ISO 8601 para `<time datetime>`: 155 → "PT2M35S".
 * @param {number} seconds
 */
export function isoDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s || !(h || m) ? `${s}S` : ''}`;
}

/**
 * Duración de un disco redondeada a minutos: "45 min".
 * @param {readonly { durationSec: number }[]} tracks
 */
export function albumMinutes(tracks) {
  const total = tracks.reduce((sum, t) => sum + t.durationSec, 0);
  return `${Math.max(1, Math.round(total / 60))} min`;
}

/**
 * Identificador para URLs a partir de un texto en español: "Trompetas y trombón" →
 * "trompetas-y-trombon".
 * @param {string} text
 */
export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Reemplaza `{clave}` con valores: `fill('Portada de {title}', { title: 'Jubileo' })`.
 * @param {string} template
 * @param {Record<string, string | number>} values
 */
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}
