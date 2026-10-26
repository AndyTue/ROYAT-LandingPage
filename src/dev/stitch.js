// @ts-check
// Página de desarrollo (no se publica): muestra el motor de bordado aislado.
import motifs from '../../assets-src/stitch/motifs.json';
import patterns from '../../assets-src/stitch/patterns.json';
import { createRng } from '../js/lib/random.js';
import { orderStitches } from '../js/stitch/order.js';
import { parsePattern, tileBand } from '../js/stitch/patterns.js';
import { HERO_JITTER, HERO_LOGO_SCALE, HERO_ORDERS, heroProgress } from '../js/stitch/presets.js';
import { createStitchLayer, setupCanvas } from '../js/stitch/renderer.js';

/** @typedef {import('../js/stitch/renderer.js').StitchLayer} StitchLayer */
/** @typedef {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, layer: StitchLayer, group: 'roses' | 'logo' | 'other' }} Entry */

const CELL = 6;
const INTRO_MS = 2200;
const dpr = window.devicePixelRatio;

/** @param {string} selector */
function $(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Falta ${selector}`);
  return el;
}

const range = /** @type {HTMLInputElement} */ ($('#progress'));
const output = /** @type {HTMLOutputElement} */ ($('.dev__value'));
const seedInput = /** @type {HTMLInputElement} */ ($('.dev__seed'));

/** @type {Entry[]} */
let entries = [];

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('../js/stitch/patterns.js').Pattern} pattern
 * @param {import('../js/stitch/order.js').OrderMode | import('../js/stitch/order.js').OrderFn} mode
 * @param {{ rng: () => number, cell?: number, jitter?: number, group?: Entry['group'] }} options
 * @returns {Entry}
 */
function makeEntry(canvas, pattern, mode, { rng, cell = CELL, jitter, group = 'other' }) {
  const ctx = setupCanvas(canvas, pattern.w, pattern.h, cell, dpr);
  const ordered = orderStitches(pattern.stitches, {
    w: pattern.w,
    h: pattern.h,
    mode,
    rng,
    jitter,
  });
  return { canvas, ctx, layer: createStitchLayer(ctx, ordered, { cell }), group };
}

function build() {
  const rng = createRng(Number(seedInput.value) || 0);
  const pal = patterns.pal;
  /** @param {string} name */
  const canvas = (name) => /** @type {HTMLCanvasElement} */ ($(`[data-layer="${name}"]`));
  const hemCols = Math.ceil(document.documentElement.clientWidth / CELL);

  entries = [
    makeEntry(canvas('left'), parsePattern(patterns.left, pal), HERO_ORDERS.left, {
      rng,
      jitter: HERO_JITTER,
      group: 'roses',
    }),
    makeEntry(canvas('logo'), parsePattern(patterns.logo, pal), HERO_ORDERS.logo, {
      rng,
      jitter: HERO_JITTER,
      cell: CELL * HERO_LOGO_SCALE,
      group: 'logo',
    }),
    makeEntry(canvas('right'), parsePattern(patterns.right, pal), HERO_ORDERS.right, {
      rng,
      jitter: HERO_JITTER,
      group: 'roses',
    }),
    makeEntry(canvas('hem'), tileBand(patterns.hem, pal, hemCols), 'lr', { rng }),
  ];

  const gallery = $('.dev__motifs');
  gallery.replaceChildren();
  /** @type {[string, readonly string[], 'out' | 'lr'][]} */
  const items = [
    ...Object.entries(motifs.motifs).map(
      ([name, rows]) => /** @type {[string, string[], 'out']} */ ([name, rows, 'out']),
    ),
    ...Object.entries(motifs.bands).map(
      ([name, rows]) => /** @type {[string, string[], 'lr']} */ ([`banda ${name}`, rows, 'lr']),
    ),
  ];
  for (const [name, rows, mode] of items) {
    const figure = document.createElement('figure');
    figure.className = 'dev__motif';
    const motifCanvas = document.createElement('canvas');
    const caption = document.createElement('figcaption');
    caption.textContent = name;
    figure.append(motifCanvas, caption);
    gallery.append(figure);
    const pattern = mode === 'lr' ? tileBand(rows, pal, 24) : parsePattern(rows, pal);
    entries.push(makeEntry(motifCanvas, pattern, mode, { rng }));
  }
}

/** @param {number} progress */
function render(progress) {
  const { roses, logo } = heroProgress(progress);
  for (const { canvas, ctx, layer, group } of entries) {
    const target = group === 'roses' ? roses : group === 'logo' ? logo : progress;
    // El bordado no retrocede: para ir hacia atrás se limpia y se vuelve a coser.
    if (layer.drawn > Math.floor(target * layer.size)) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      layer.reset();
    }
    layer.advance(target);
  }
  output.value = progress.toFixed(2);
}

function play() {
  const start = performance.now();
  /** @param {number} now */
  const frame = (now) => {
    const progress = Math.min(1, (now - start) / INTRO_MS);
    range.value = String(progress);
    render(progress);
    if (progress < 1) requestAnimationFrame(frame);
  };
  render(0);
  requestAnimationFrame(frame);
}

range.addEventListener('input', () => render(Number(range.value)));
seedInput.addEventListener('change', () => {
  build();
  render(Number(range.value));
});
$('[data-action="play"]').addEventListener('click', play);
$('[data-action="all"]').addEventListener('click', () => {
  range.value = '1';
  for (const { layer } of entries) layer.drawAll();
  output.value = '1.00';
});

build();
render(Number(range.value));
