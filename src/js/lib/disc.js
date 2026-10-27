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

/** Altura (en discos) de cada vinilo del arco de escritorio según su distancia al centro. */
const ARC_Y = [0.55, 0.44, 0.33, 0.22, 0.12, 0, -0.09, 0.02, 0.14, 0.27, 0.4];

/**
 * Tabla interpolada: `d` va de −5 a 5 y entre enteros se mezclan los dos vecinos.
 * @param {readonly number[]} table once valores, de d = −5 a d = 5
 * @param {number} d
 */
function lookup(table, d) {
  const x = clamp(d, -5, 5) + 5;
  const i = Math.min(table.length - 2, Math.floor(x));
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

/**
 * Pose en perspectiva de un vinilo del arco de escritorio (DIS-1), como en el prototipo: la
 * hilera cruza la pantalla de lado a lado, los vecinos se inclinan sobre su eje y se traslapan.
 * Se compone con `perspective` en el contenedor.
 * @param {number} d disco − posición (negativo a la izquierda)
 * @param {{ size: number, vw: number }} frame `size` px del vinilo central; `vw` ancho de la pantalla
 * @returns {{ transform: string, opacity: number, z: number }}
 */
export function arcPose(d, { size, vw }) {
  const x = d * 0.74;
  const y = lookup(ARC_Y, d);
  const z = d <= 0 ? d * 0.3 : d <= 1 ? 0.12 * d : 0.12 - 0.18 * Math.min(1, d - 1);
  const yaw = 22 - 9 * d;
  // El centro del escenario está al 45 % del ancho; se muestra todo disco que aún toca la pantalla.
  const cx = vw * 0.45 + x * size;
  const reach = size * 0.59;
  const opacity = clamp(Math.min(cx + reach, vw + reach - cx) / (size * 0.3));
  return {
    transform: `translate3d(${(x * size).toFixed(1)}px, ${(y * size).toFixed(1)}px, ${(z * size).toFixed(1)}px) rotateZ(-6deg) rotateY(${yaw.toFixed(1)}deg) rotateX(8deg)`,
    opacity,
    z: Math.round(100 + d * 10),
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
