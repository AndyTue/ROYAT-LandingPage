// @ts-check
// Medición de secciones fuera del loop (ARCHITECTURE §4): se mide al cargar, al cambiar el
// tamaño y cuando terminan de cargar las fuentes; `update()` solo usa números ya medidos.

/**
 * @typedef {{ id: string, top: number, bottom: number, height: number }} Block
 * @typedef {{ vw: number, vh: number, total: number, compact: boolean, blocks: Block[] }} Metrics
 */

/**
 * Diseño móvil: pantallas angostas (tokens: 48em) y cualquier pantalla vertical. El escritorio es
 * un escenario de 1536×800: en una tableta vertical se encogía al ancho y dejaba media pantalla
 * vacía. Debe coincidir con los `@media` del CSS. Sin rangos (`width < 48em`): los navegadores
 * viejos (Safari < 16.4, el de la Nintendo Switch) no los entienden.
 */
export const COMPACT_QUERY = '(max-width: 47.99em), (orientation: portrait)';
export const DESKTOP_QUERY = '(min-width: 48em) and (orientation: landscape)';

/**
 * Unidad del diseño móvil (1 = 1px a 390 de ancho). En teléfonos crece con el ancho; en una
 * tableta vertical la columna de 390 se agranda hasta que su alto equivale a 700 px del
 * prototipo (nunca menos que el tope anterior de 1.5): así texto, fotos, mapa y gato guardan
 * la proporción del teléfono y la columna se centra. Igual que `--um` en `tokens.css`.
 * @param {number} vw @param {number} vh
 */
export const mobileUnit = (vw, vh) => Math.min(vw / 390, Math.max(vh / 700, 1.5));

/**
 * @param {{
 *   win: Window,
 *   doc: Document,
 *   ids: readonly string[],
 *   onChange: (metrics: Metrics) => void,
 *   resolve?: (id: string, vh: number) => number | null,
 * }} options
 *   `resolve` da el inicio de una sección que no se puede medir en el documento (p. ej. una
 *   que vive dentro de una escena fija); si devuelve null, se mide su caja.
 */
export function createLayout({ win, doc, ids, onChange, resolve }) {
  /** @type {Metrics} */
  let metrics = { vw: 0, vh: 0, total: 0, compact: false, blocks: [] };
  let timer = 0;

  function measure() {
    const scroll = win.scrollY;
    const blocks = ids.flatMap((id) => {
      const el = doc.getElementById(id);
      if (!el) return [];
      const rect = el.getBoundingClientRect();
      const top = resolve?.(id, win.innerHeight) ?? rect.top + scroll;
      return [{ id, top, bottom: top + rect.height, height: rect.height }];
    });
    metrics = {
      vw: doc.documentElement.clientWidth,
      vh: win.innerHeight,
      total: doc.documentElement.scrollHeight,
      compact: win.matchMedia(COMPACT_QUERY).matches,
      blocks,
    };
    onChange(metrics);
  }

  // Varios eventos seguidos (redimensionar, fuentes, imágenes) se juntan en una sola medición.
  function schedule() {
    win.clearTimeout(timer);
    timer = win.setTimeout(measure, 80);
  }

  const resize = new /** @type {any} */ (win).ResizeObserver(schedule);
  resize.observe(doc.body);
  win.addEventListener('orientationchange', schedule);
  doc.fonts?.ready.then(schedule);

  return {
    measure,
    get metrics() {
      return metrics;
    },
    destroy() {
      resize.disconnect();
      win.removeEventListener('orientationchange', schedule);
      win.clearTimeout(timer);
    },
  };
}

/**
 * Sección activa para una posición de scroll: la última cuyo inicio ya pasó (con un margen del
 * 40 % de la pantalla, para que cambie cuando ocupa buena parte de la vista).
 * @param {readonly Block[]} blocks en orden de aparición
 * @param {number} y scroll
 * @param {number} vh alto de la pantalla
 * @returns {string | null}
 */
export function activeSection(blocks, y, vh) {
  let active = blocks[0]?.id ?? null;
  for (const block of blocks) if (y + vh * 0.4 >= block.top) active = block.id;
  return active;
}
