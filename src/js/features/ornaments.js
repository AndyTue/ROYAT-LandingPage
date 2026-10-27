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
 * @typedef {{ pal: string[], motifs: Record<string, string[]>, bands: Record<string, string[]>, logo?: string[] }} OrnamentData
 * @typedef {{ slot: HTMLElement, layer: import('../stitch/renderer.js').StitchLayer, progress: number }} Ornament
 */

/** Celda del bordado en escritorio y en móvil (px). */
const CELL = { desktop: 6, compact: 4.5 };
/**
 * Cuánto de la pantalla recorre un ornamento mientras se borda: empieza cuando su borde
 * superior está al 88 % de la altura y termina cuando llega al 43 %.
 */
const START = 0.88;
const END = 0.43;

/** Celda de los ornamentos según el diseño (escritorio o móvil). */
export const cellFor = (/** @type {boolean} */ compact) => (compact ? CELL.compact : CELL.desktop);

/**
 * Dibuja el canvas de un hueco `[data-ornament]` y devuelve su capa de bordado.
 * @param {HTMLElement} slot
 * @param {number} index
 * @param {OrnamentData} data
 * @param {number} cell
 * @returns {Ornament | null}
 */
export function mountOrnament(slot, index, data, cell) {
  const { motif, band, order = 'out', flip = '', map = '', pattern: named = '', cell: scale = '' } = slot.dataset;
  // `data-cell` es un factor sobre la celda (el logo de Contacto se borda a 0.4 de la celda).
  if (scale) cell *= Number(scale);
  /** @type {import('../stitch/patterns.js').Pattern | undefined} */
  let pattern;
  if (band) {
    const cols = Math.max(1, Math.floor(slot.clientWidth / cell));
    pattern = tileBand(data.bands[band] ?? [], data.pal, cols);
  } else if (named === 'logo' && data.logo) {
    pattern = parsePattern(data.logo, data.pal);
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
  const ctx = setupCanvas(canvas, pattern.w, pattern.h, cell, window.devicePixelRatio);
  const stitches = orderStitches(pattern.stitches, {
    w: pattern.w,
    h: pattern.h,
    mode: /** @type {OrderMode} */ (band ? 'lr' : order),
    rng: createRng(2018 + index),
  });
  return { slot, layer: createStitchLayer(ctx, stitches, { cell }), progress: 0 };
}

/**
 * Ornamentos de punto de cruz (`[data-ornament]`) que se bordan según entran en pantalla.
 * Los que van dentro de una pista horizontal (`data-ornament-track`) los maneja esa sección.
 * @param {{
 *   root: ParentNode,
 *   data: OrnamentData,
 *   getMetrics: () => Metrics,
 *   reduced: boolean,
 *   skip?: (slot: HTMLElement) => boolean,
 * }} options
 * @returns {import('../core/engine.js').Section}
 */
export function createOrnaments({ root, data, getMetrics, reduced, skip = () => false }) {
  const slots = findAll(root, '[data-ornament]', HTMLElement);
  /** @type {(Ornament & { startY: number, endY: number })[]} */
  let items = [];

  function measure() {
    const { compact, vh, total } = getMetrics();
    const scroll = window.scrollY;
    // En escritorio la celda escala con la pantalla como el resto del prototipo (6 px a 1536×800).
    const { vw } = getMetrics();
    const cell = compact ? cellFor(true) : cellFor(false) * Math.min(vh / 800, vw / 1100);
    items = slots.flatMap((slot, index) => {
      if (skip(slot)) return [];
      const ornament = mountOrnament(slot, index, data, cell);
      if (!ornament) return [];
      const top = slot.getBoundingClientRect().top + scroll;
      const startY = top - vh * START;
      // Cerca del final de la página el scroll no alcanza: el bordado termina al llegar al fondo.
      const endY = Math.max(startY + 1, Math.min(top - vh * END, total - vh - 1));
      return [{ ...ornament, startY, endY }];
    });
    if (reduced) for (const item of items) item.layer.drawAll();
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
