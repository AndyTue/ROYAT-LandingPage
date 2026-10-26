// @ts-check
// Matemática de la pista horizontal de Historia: pura y sin DOM, para probarla aparte.
import { clamp, lerp, range } from '../core/motion.js';

/**
 * @typedef {[number, number, number]} Rgb
 * @typedef {{ left: number, width: number, tone: string }} Panel
 */

/** Parte de la pantalla (en ancho) donde dos tonos se mezclan alrededor del borde entre paneles. */
export const TONE_BAND = 0.18;

/**
 * Convierte `#rrggbb` en componentes 0–255.
 * @param {string} hex
 * @returns {Rgb}
 */
export function parseHex(hex) {
  const value = hex.trim().replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Mezcla dos colores.
 * @param {Rgb} a
 * @param {Rgb} b
 * @param {number} t
 * @returns {Rgb}
 */
export const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** @param {Rgb} rgb */
export const toCss = (rgb) => `rgb(${rgb.map((c) => Math.round(c)).join(' ')})`;

/**
 * Paso suave 0→1 (sin saltos de velocidad en los extremos).
 * @param {number} t
 */
export const smoothstep = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

/**
 * Tono (o mezcla de dos tonos) bajo el centro de la pantalla. Lejos de un borde entre paneles
 * es el tono del panel; cerca, se mezcla con el vecino.
 * @param {readonly Panel[]} panels en orden, de izquierda a derecha
 * @param {number} center posición del centro de la pantalla en coordenadas de la pista
 * @param {number} band ancho de la zona de mezcla, en px
 * @returns {{ from: string, to: string, t: number }}
 */
export function toneAt(panels, center, band) {
  if (!panels.length) return { from: '', to: '', t: 0 };
  let index = panels.findIndex((p) => center < p.left + p.width);
  if (index < 0) index = panels.length - 1;
  const current = panels[index];
  const next = panels[index + 1];
  const prev = panels[index - 1];
  if (next && center > next.left - band) {
    return {
      from: current.tone,
      to: next.tone,
      t: smoothstep((center - (next.left - band)) / (2 * band)),
    };
  }
  if (prev && center < current.left + band) {
    return {
      from: prev.tone,
      to: current.tone,
      t: smoothstep((center - (current.left - band)) / (2 * band)),
    };
  }
  return { from: current.tone, to: current.tone, t: 0 };
}

/**
 * Posición horizontal de la pista para un scroll vertical.
 * @param {number} y scroll
 * @param {number} start inicio de la sección
 * @param {number} maxX recorrido horizontal (ancho de la pista − ancho de pantalla)
 */
export const trackX = (y, start, maxX) => range(y, start, start + maxX) * maxX;

/**
 * Desplazamiento de paralaje de un elemento: se mueve contra el scroll según su distancia al
 * centro de la pantalla.
 * @param {number} center centro del elemento en coordenadas de la pista
 * @param {number} x posición de la pista
 * @param {number} vw ancho de pantalla
 * @param {number} k intensidad (0.1 ≈ 10 % del ancho de pantalla en el borde)
 */
export const parallaxX = (center, x, vw, k) => -((center - x - vw / 2) / vw) * k * vw;

/**
 * Avance (0–1) del bordado de un ornamento dentro de la pista: empieza al entrar por la
 * derecha y termina cuando pasa de la mitad de la pantalla.
 * @param {number} screenX posición del ornamento en pantalla
 * @param {number} vw ancho de pantalla
 */
export const ornamentProgress = (screenX, vw) => range(vw * 0.92 - screenX, 0, vw * 0.45);
