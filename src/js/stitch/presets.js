// @ts-check

/** @typedef {import('./order.js').OrderFn} OrderFn */

/**
 * Órdenes de costura del Hero (prototipo v108): las rosas crecen desde el borde de la
 * pantalla hacia el logo y de abajo hacia arriba; el logo se borda de izquierda a derecha.
 * @type {{ left: OrderFn, right: OrderFn, logo: OrderFn }}
 */
export const HERO_ORDERS = {
  left: (i, j, w, h) => (i / w) * 0.55 + (1 - j / h) * 0.25,
  right: (i, j, w, h) => ((w - i) / w) * 0.55 + (1 - j / h) * 0.25,
  logo: (i, j, w, h) => (i / w) * 0.8 + (j / h) * 0.1,
};

/** Desorden de las capas grandes del Hero; los motivos pequeños usan el de `orderStitches`. */
export const HERO_JITTER = 0.18;

/** El logo se borda a 0.7 del tamaño de celda de las rosas. */
export const HERO_LOGO_SCALE = 0.7;

/**
 * Reparte un solo avance entre las capas del Hero: las rosas arrancan primero y el logo
 * empieza cuando ya van al 16 %.
 * @param {number} progress entre 0 y 1
 * @returns {{ roses: number, logo: number }}
 */
export function heroProgress(progress) {
  const clamp = (/** @type {number} */ v) => Math.min(1, Math.max(0, v));
  return { roses: clamp(progress * 1.08), logo: clamp((progress - 0.16) / 0.84) };
}
