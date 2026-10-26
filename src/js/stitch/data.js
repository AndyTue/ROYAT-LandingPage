// @ts-check
// Los patrones de bordado pesan decenas de KB: se piden en un archivo aparte, después del
// primer pintado (el contenido ya se ve gracias al SVG y al HTML del build).

/**
 * @typedef {{ pal: string[], left: string[], right: string[], logo: string[], hem: string[] }} Patterns
 * @typedef {{ motifs: Record<string, string[]>, bands: Record<string, string[]> }} Motifs
 */

/** @returns {Promise<Patterns>} */
export async function loadPatterns() {
  const module = await import('../../../assets-src/stitch/patterns.json');
  return module.default;
}

/** @returns {Promise<Motifs>} */
export async function loadMotifs() {
  const module = await import('../../../assets-src/stitch/motifs.json');
  return module.default;
}

/**
 * Rejilla del mapa y municipios (`content/map-grid.json` y `places.json`).
 * @returns {Promise<{ grid: import('../sections/map-math.js').MapGrid, places: import('../sections/map-math.js').Place[], states: string[] }>}
 */
export async function loadMap() {
  const [grid, places] = await Promise.all([
    import('../../../content/map-grid.json'),
    import('../../../content/places.json'),
  ]);
  return { grid: grid.default, places: places.default.places, states: places.default.states };
}
