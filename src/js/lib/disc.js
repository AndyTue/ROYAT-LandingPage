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

/** Altura (en discos) de cada vinilo según su distancia al centro (prototipo `pose`). */
const POSE_Y = {
  '-5': 0.55,
  '-4': 0.44,
  '-3': 0.33,
  '-2': 0.22,
  '-1': 0.12,
  0: 0,
  1: -0.09,
  2: 0.02,
  3: 0.14,
  4: 0.27,
  5: 0.4,
};

/**
 * Distancia circular de un disco al actual: de −n/2 a n/2.
 * @param {number} i
 * @param {number} cur
 * @param {number} n
 */
export function ringOffset(i, cur, n) {
  let dx = (((i - cur) % n) + n) % n;
  if (dx > n / 2) dx -= n;
  return dx;
}

/**
 * Pose en perspectiva de un vinilo de la galería de escritorio (prototipo `pose`): la hilera
 * cruza la pantalla de lado a lado; con el tocadiscos encendido, el central se acuesta sobre él
 * y los vecinos se hacen a un lado.
 * @param {number} dx distancia al disco actual (entero)
 * @param {boolean} deckOn
 * @param {{ V: number, W: number }} frame `V` lado del escenario (389 a U = 1); `W` ancho de pantalla
 * @returns {{ transform: string, z: number, opacity: number }}
 */
export function discPose(dx, deckOn, { V, W }) {
  let x = dx * 0.74;
  let y = POSE_Y[/** @type {keyof typeof POSE_Y} */ (String(dx))] ?? 0;
  let z = dx <= 0 ? dx * 0.3 : dx === 1 ? 0.12 : -0.06;
  let yaw = 22 - 9 * dx;
  let rx = 8;
  let zi = 100 + dx * 10;
  // La hilera va de orilla a orilla: se muestra todo disco que aún toca la pantalla.
  const cx = W * 0.45 + x * V;
  let opacity = cx > (-230 * V) / 389 && cx < W + (230 * V) / 389 ? 1 : 0;
  if (deckOn) {
    if (dx === 0) {
      x = 0;
      y = -0.08;
      z = -0.05;
      yaw = -14;
      rx = 50;
      zi = 200;
    } else {
      x += Math.sign(dx) * 0.5;
      z -= 0.35;
      y += dx > 0 ? 0.16 : -0.02;
      if (Math.abs(dx) > 2) opacity = 0;
    }
  }
  return {
    transform: `translate3d(${(x * V).toFixed(1)}px,${(y * V).toFixed(1)}px,${(z * V).toFixed(1)}px) rotateZ(-6deg) rotateY(${yaw}deg) rotateX(${rx}deg)`,
    z: zi,
    opacity,
  };
}

/**
 * Pose de un vinilo de la galería móvil (prototipo móvil `pose`): el central grande y los
 * vecinos a los lados, más chicos y girados. Medidas en px a 390 de ancho (× `um`).
 * @param {number} dx distancia al disco actual (entero)
 * @param {boolean} deckOn
 * @param {number} um px por unidad del prototipo
 * @returns {{ transform: string, z: number, opacity: number }}
 */
export function discPoseMobile(dx, deckOn, um) {
  const P = deckOn
    ? { 0: [0, 0, 1, 0], 1: [212, 70, 0.52, 16], 2: [300, 150, 0.36, 26] }
    : { 0: [0, 0, 1, 0], 1: [150, 40, 0.6, 12], 2: [236, 104, 0.4, 22] };
  const ad = Math.abs(dx);
  const q = P[/** @type {0 | 1 | 2} */ (ad)] ?? [300, 150, 0.3, 30];
  const sg = dx < 0 ? -1 : 1;
  const x = (q[0] * sg * um).toFixed(1);
  const y = (q[1] * um).toFixed(1);
  if (deckOn && ad === 2)
    return { transform: `translate3d(${x}px,${y}px,0) scale(${q[2]})`, z: 60, opacity: 0 };
  return {
    transform: `translate3d(${x}px,${y}px,0) rotate(${q[3] * sg}deg) scale(${q[2]})`,
    z: 100 - ad * 10,
    opacity: ad === 0 ? 1 : ad === 1 ? 0.95 : ad === 2 ? 0.55 : 0,
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
