// @ts-check
import { range } from '../core/motion.js';
import { findAll } from '../lib/dom.js';
import { createRng } from '../lib/random.js';
import { orderStitches } from '../stitch/order.js';
import { flipRows, parseColorMap, parsePattern, tileBand } from '../stitch/patterns.js';
import { createStitchLayer, setupCanvas } from '../stitch/renderer.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('../stitch/order.js').OrderMode} OrderMode
 * @typedef {{ pal: string[], motifs: Record<string, string[]>, bands: Record<string, string[]> }} OrnamentData
 * @typedef {{
 *   slot: HTMLElement,
 *   layer: import('../stitch/renderer.js').StitchLayer,
 *   startY: number,
 *   endY: number,
 *   progress: number,
 * }} Ornament
 */

/** Celda del bordado en escritorio y en móvil (px). */
const CELL = { desktop: 6, compact: 4.5 };
/**
 * Cuánto de la pantalla recorre un ornamento mientras se borda: empieza cuando su borde
 * superior está al 88 % de la altura y termina cuando llega al 43 %.
 */
const START = 0.88;
const END = 0.43;

/**
 * Ornamentos de punto de cruz (`[data-ornament]`) que se bordan según entran en pantalla
 * (MAP, historia y contacto). Cada hueco declara su motivo y su orden de costura.
 * @param {{
 *   root: ParentNode,
 *   data: OrnamentData,
 *   getMetrics: () => Metrics,
 *   reduced: boolean,
 * }} options
 * @returns {import('../core/engine.js').Section}
 */
export function createOrnaments({ root, data, getMetrics, reduced }) {
  const slots = findAll(root, '[data-ornament]', HTMLElement);
  /** @type {Ornament[]} */
  let items = [];

  /** @param {HTMLElement} slot @param {number} index @param {number} cell @param {number} dpr */
  function mount(slot, index, cell, dpr) {
    const { motif, band, order = 'out', flip = '', map = '' } = slot.dataset;
    /** @type {import('../stitch/patterns.js').Pattern | undefined} */
    let pattern;
    if (band) {
      const cols = Math.max(1, Math.floor(slot.clientWidth / cell));
      pattern = tileBand(data.bands[band] ?? [], data.pal, cols);
    } else if (motif && data.motifs[motif]) {
      pattern = parsePattern(flipRows(data.motifs[motif], flip), data.pal, {
        colorMap: parseColorMap(map),
      });
    }
    if (!pattern || !pattern.w) return null;
    let canvas = slot.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      slot.append(canvas);
    }
    const ctx = setupCanvas(canvas, pattern.w, pattern.h, cell, dpr);
    const stitches = orderStitches(pattern.stitches, {
      w: pattern.w,
      h: pattern.h,
      mode: /** @type {OrderMode} */ (band ? 'lr' : order),
      rng: createRng(2018 + index),
    });
    return createStitchLayer(ctx, stitches, { cell });
  }

  function measure() {
    const { compact, vh, total } = getMetrics();
    const scroll = window.scrollY;
    const cell = compact ? CELL.compact : CELL.desktop;
    items = slots.flatMap((slot, index) => {
      const layer = mount(slot, index, cell, window.devicePixelRatio);
      if (!layer) return [];
      const top = slot.getBoundingClientRect().top + scroll;
      const startY = top - vh * START;
      // Cerca del final de la página el scroll no alcanza: el bordado termina al llegar al fondo.
      const endY = Math.max(startY + 1, Math.min(top - vh * END, total - vh - 1));
      return [{ slot, layer, startY, endY, progress: 0 }];
    });
    // Tras re-medir, lo que ya estaba bordado vuelve a dibujarse completo.
    for (const item of items) {
      if (reduced) item.layer.drawAll();
    }
  }

  return {
    id: 'ornamentos',
    start: 0,
    end: Number.MAX_SAFE_INTEGER,
    margin: 0,
    measure,
    /** @param {ScrollState} state */
    update(state) {
      if (reduced) return;
      for (const item of items) {
        // Un ornamento no se "desteje" al volver atrás: solo avanza.
        const p = Math.max(item.progress, range(state.y, item.startY, item.endY));
        if (p !== item.progress) {
          item.progress = p;
          item.layer.advance(p);
        }
      }
    },
  };
}
