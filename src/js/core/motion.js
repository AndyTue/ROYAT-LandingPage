// @ts-check
// Matemática de movimiento: pura y sin DOM, para poder probarla aparte.

/**
 * @param {number} value
 * @param {number} [min]
 * @param {number} [max]
 */
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** Interpolación lineal. */
export const lerp = (
  /** @type {number} */ from,
  /** @type {number} */ to,
  /** @type {number} */ t,
) => from + (to - from) * t;

/**
 * Avance de `value` dentro de [start, end], acotado a 0–1. Si el rango no tiene tamaño, es un
 * escalón en `start`.
 * @param {number} value
 * @param {number} start
 * @param {number} end
 */
export function range(value, start, end) {
  if (end === start) return value >= start ? 1 : 0;
  return clamp((value - start) / (end - start));
}

/** @param {number} t */
export const easeOutCubic = (t) => 1 - (1 - clamp(t)) ** 3;

/** @param {number} t */
export const easeInOutCubic = (t) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
};

/**
 * Curva cúbica de Bézier como CSS (`cubic-bezier(x1, y1, x2, y2)`), para igualar en JS las
 * curvas de `tokens.css`. Resuelve x(t) con Newton–Raphson y bisección de respaldo.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {(x: number) => number}
 */
export function cubicBezier(x1, y1, x2, y2) {
  const coord = (/** @type {number} */ t, /** @type {number} */ a, /** @type {number} */ b) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  const slope = (/** @type {number} */ t, /** @type {number} */ a, /** @type {number} */ b) =>
    3 * (1 - t) ** 2 * a + 6 * (1 - t) * t * (b - a) + 3 * t ** 2 * (1 - b);
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = coord(t, x1, x2) - x;
      if (Math.abs(err) < 1e-6) return coord(t, y1, y2);
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = coord(t, x1, x2);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return coord(t, y1, y2);
  };
}

/** Curvas de DESIGN-TOKENS (`--ease-*`). */
export const EASE = {
  out: cubicBezier(0.2, 0.7, 0.2, 1),
  back: cubicBezier(0.34, 1.56, 0.64, 1),
  inOut: cubicBezier(0.7, 0, 0.2, 1),
  curtain: cubicBezier(0.6, 0, 0.2, 1),
  standard: cubicBezier(0.4, 0, 0.2, 1),
};

/**
 * Un paso de suavizado hacia `target`: avanza `factor` de la distancia y se pega al destino
 * cuando queda menos de `epsilon` (si no, el loop nunca terminaría de moverse).
 * @param {number} current
 * @param {number} target
 * @param {number} factor 0–1 por frame (1 = sin suavizado)
 * @param {number} [epsilon]
 */
export function smooth(current, target, factor, epsilon = 0.3) {
  const next = current + (target - current) * factor;
  return Math.abs(target - next) < epsilon ? target : next;
}

/**
 * ¿Pidió el usuario menos movimiento?
 * @param {Pick<Window, 'matchMedia'>} [win]
 */
export function prefersReducedMotion(win = window) {
  return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
