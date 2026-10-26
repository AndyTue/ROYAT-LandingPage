// @ts-check
import { easeOutCubic } from '../core/motion.js';
import { createRng } from '../lib/random.js';

/** Dispersión máxima de cada letra, en `em`, y giro en grados. */
const SPREAD = { x: 0.9, y: 0.7, rotate: 28 };

/**
 * Desvío fijo de una letra: la misma letra siempre se dispersa hacia el mismo lado, así que
 * la animación es repetible y no parpadea.
 * @param {number} index
 * @param {number} [seed]
 * @returns {{ x: number, y: number, rotate: number }}
 */
export function scatterOf(index, seed = 7) {
  const rng = createRng(seed * 1000 + index);
  return {
    x: (rng() * 2 - 1) * SPREAD.x,
    y: (rng() * 2 - 1) * SPREAD.y,
    rotate: (rng() * 2 - 1) * SPREAD.rotate,
  };
}

/**
 * Transformación de una letra para un avance `p` (0 = dispersa, 1 = en su lugar).
 * @param {{ x: number, y: number, rotate: number }} offset
 * @param {number} p
 * @returns {{ transform: string, opacity: number }}
 */
export function letterStyle(offset, p) {
  const k = 1 - easeOutCubic(p);
  return {
    transform: `translate3d(${(offset.x * k).toFixed(3)}em, ${(offset.y * k).toFixed(3)}em, 0) rotate(${(offset.rotate * k).toFixed(2)}deg)`,
    opacity: Math.min(1, p * 2.5),
  };
}

/**
 * Parte el texto de cada elemento en letras (`<span class="ch">`) para animarlas. El texto
 * accesible va aparte (el elemento original es `aria-hidden`).
 * @param {readonly HTMLElement[]} elements
 * @returns {HTMLElement[]} las letras, en orden
 */
export function splitLetters(elements) {
  /** @type {HTMLElement[]} */
  const letters = [];
  for (const el of elements) {
    const text = el.textContent ?? '';
    el.replaceChildren(
      ...[...text].map((char) => {
        const span = document.createElement('span');
        span.className = 'ch';
        span.textContent = char;
        letters.push(span);
        return span;
      }),
    );
  }
  return letters;
}

/**
 * Aplica el avance `p` a un conjunto de letras (solo `transform` y `opacity`).
 * @param {readonly HTMLElement[]} letters
 * @param {readonly { x: number, y: number, rotate: number }[]} offsets
 * @param {number} p
 */
export function applyLetters(letters, offsets, p) {
  letters.forEach((letter, i) => {
    const style = letterStyle(offsets[i], p);
    letter.style.transform = style.transform;
    letter.style.opacity = String(style.opacity);
  });
}
