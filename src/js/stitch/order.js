// @ts-check

/**
 * @typedef {import('./patterns.js').Stitch} Stitch
 * @typedef {import('../lib/random.js').Rng} Rng
 * @typedef {Stitch & { shade: number }} OrderedStitch `shade` aclara u oscurece el hilo un poco.
 * @typedef {'lr' | 'down' | 'up' | 'out'} OrderMode
 * @typedef {(i: number, j: number, w: number, h: number) => number} OrderFn
 */

/** @type {Record<OrderMode, OrderFn>} */
const MODES = {
  lr: (i, _j, w) => i / w,
  down: (_i, j, _w, h) => j / h,
  up: (_i, j, _w, h) => 1 - j / h,
  // Desde el centro hacia afuera, como se borda una flor.
  out: (i, j, w, h) =>
    Math.hypot(i + 0.5 - w / 2, j + 0.5 - h / 2) / (Math.hypot(w / 2, h / 2) || 1),
};

/**
 * Ordena las puntadas como se bordarían a mano: una dirección general con algo de
 * desorden (`jitter`) para que el avance no se vea mecánico. Cada puntada recibe también
 * una variación de tono.
 * @param {readonly Stitch[]} stitches
 * @param {{ w: number, h: number, mode: OrderMode | OrderFn, rng: Rng, jitter?: number }} options
 * @returns {OrderedStitch[]}
 */
export function orderStitches(stitches, { w, h, mode, rng, jitter = 0.12 }) {
  const key = typeof mode === 'function' ? mode : MODES[mode];
  if (!key) throw new Error(`Orden de costura desconocido: "${mode}"`);
  return stitches
    .map((s) => ({
      stitch: { ...s, shade: (rng() - 0.5) * 0.12 },
      k: key(s.i, s.j, w, h) + rng() * jitter,
    }))
    .sort((a, b) => a.k - b.k)
    .map(({ stitch }) => stitch);
}
