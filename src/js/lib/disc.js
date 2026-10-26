// @ts-check
// Lógica pura de la discografía: arco de vinilos, rutas de audio, totales y tiempos.
import { clamp } from '../core/motion.js';
import { fill, formatDuration } from './format.js';

/**
 * @typedef {{ title: string, durationSec: number, guest?: string }} Track
 * @typedef {{ spotifyId: string, title: string, type: string, year: number, color: string, cover: string, tracks: Track[] }} Disc
 */

/**
 * URL del audio de una pista: `<base>/<spotifyId>/NN.m4a` (ver `scripts/encode-audio.mjs`).
 * @param {string} baseUrl sin barra final
 * @param {string} spotifyId
 * @param {number} trackIndex desde 0
 */
export const trackUrl = (baseUrl, spotifyId, trackIndex) =>
  `${baseUrl}/${spotifyId}/${String(trackIndex + 1).padStart(2, '0')}.m4a`;

/** Duración total de un disco en segundos. */
export const discSeconds = (/** @type {Disc} */ disc) =>
  disc.tracks.reduce((sum, t) => sum + t.durationSec, 0);

/** Pistas con invitado. */
export const guestCount = (/** @type {Disc} */ disc) => disc.tracks.filter((t) => t.guest).length;

/**
 * Reloj del reproductor: "1:05 / 3:34".
 * @param {number} current
 * @param {number} total
 */
export const clock = (current, total) => `${formatDuration(current)} / ${formatDuration(total)}`;

/**
 * Duración legible de un disco: "3 min" o "45 min".
 * @param {Disc} disc
 * @param {string} template `{n} min`
 */
export const minutesLabel = (disc, template) =>
  fill(template, { n: Math.max(1, Math.round(discSeconds(disc) / 60)) });

/**
 * Posición continua del arco (0 = primer disco, n-1 = último) para un scroll.
 * @param {number} y scroll
 * @param {number} start inicio de la sección
 * @param {number} step px de scroll entre un disco y el siguiente
 * @param {number} count discos
 */
export const arcPosition = (y, start, step, count) =>
  clamp((y - start) / Math.max(1, step), 0, count - 1);

/** Scroll que deja el disco `index` en el centro. */
export const scrollForIndex = (
  /** @type {number} */ index,
  /** @type {number} */ start,
  /** @type {number} */ step,
) => start + index * step;

/**
 * Colocación de un vinilo en el arco según su distancia `d` al centro (en discos).
 * El central es el más grande y los vecinos se alejan, bajan y se inclinan en arco.
 * @param {number} d disco − posición (negativo a la izquierda)
 * @param {{ spacing: number, size: number }} frame `spacing` px entre centros; `size` px del central
 * @returns {{ x: number, y: number, scale: number, rotate: number, opacity: number, z: number }}
 */
export function arcSlot(d, { spacing, size }) {
  const a = Math.abs(d);
  return {
    x: d * spacing,
    y: d * d * size * 0.075 + d * size * 0.03,
    scale: 1 / (1 + a * 0.13),
    rotate: d * 5,
    opacity: clamp(1.6 - a * 0.28),
    z: Math.round(100 - a * 10),
  };
}

/**
 * Siguiente disco con vuelta al principio.
 * @param {number} index
 * @param {number} count
 * @param {1 | -1} [direction]
 */
export const wrapIndex = (index, count, direction = 1) => (index + direction + count) % count;

/**
 * Segundos del temporizador de avance automático (DIS-2), de 0 a 1.
 * @param {number} idleMs tiempo sin interacción
 * @param {number} afterMs espera antes de avanzar
 */
export const idleProgress = (idleMs, afterMs) => clamp(idleMs / afterMs);
