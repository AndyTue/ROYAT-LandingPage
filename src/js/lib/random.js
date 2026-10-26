// @ts-check

/** @typedef {() => number} Rng Devuelve un número en [0, 1), como Math.random. */

/**
 * Generador pseudoaleatorio con semilla (mulberry32). Con la misma semilla produce la
 * misma secuencia: el bordado sale idéntico en cada visita y las pruebas son deterministas.
 * @param {number} seed
 * @returns {Rng}
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
