// @ts-check
import { range } from '../core/motion.js';
import { applyLetters, scatterOf, splitLetters } from '../features/letters.js';
import { cellFor, mountOrnament } from '../features/ornaments.js';
import { find, findAll } from '../lib/dom.js';
import {
  mixRgb,
  ornamentProgress,
  parallaxX,
  parseHex,
  toCss,
  TONE_BAND,
  toneAt,
  trackX,
} from './history-math.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('../features/ornaments.js').OrnamentData} OrnamentData
 * @typedef {import('./history-math.js').Panel} Panel
 * @typedef {{ el: HTMLElement, k: number, cx: number, cy: number }} Drift
 * @typedef {{ bg: import('./history-math.js').Rgb, fg: import('./history-math.js').Rgb, fg2: import('./history-math.js').Rgb, acc: import('./history-math.js').Rgb, acc2: import('./history-math.js').Rgb }} Tone
 */

/** Tonos de panel que usa la pista (DESIGN-TOKENS). */
const TONE_NAMES = ['navy', 'paper', 'sand', 'red', 'cream'];
/** Grados de giro de un vinilo por px de recorrido. */
const SPIN = 0.18;

/**
 * Historia: pista horizontal fija en escritorio (HIS-3) y línea de tiempo vertical en móvil
 * (HIS-4). Con reduced-motion o sin JS nunca hay pista ni movimiento.
 * @param {{
 *   root: HTMLElement,
 *   data: OrnamentData,
 *   getMetrics: () => Metrics,
 *   reduced: boolean,
 * }} options
 * @returns {import('../core/engine.js').Section & { isTrack(): boolean }}
 */
export function createHistory({ root, data, getMetrics, reduced }) {
  const stage = find(root, '[data-history-stage]', HTMLElement);
  const track = find(root, '[data-history-track]', HTMLElement);
  const panelEls = findAll(root, '[data-tone]', HTMLElement);
  const slots = findAll(root, '[data-ornament]', HTMLElement);
  const spinners = findAll(root, '[data-spin]', HTMLElement);
  const lineEls = findAll(root, '[data-letters]', HTMLElement);
  const letters = reduced ? [] : splitLetters(lineEls);
  const offsets = letters.map((_, i) => scatterOf(i));

  let trackMode = false;
  let length = -1;
  /** @type {Panel[]} */
  let panels = [];
  /** @type {Drift[]} */
  let drifts = [];
  /** @type {{ ornament: NonNullable<ReturnType<typeof mountOrnament>>, cx: number }[]} */
  let stitched = [];
  let lettersTop = 0;
  let maxX = 0;
  let lastTone = '';
  /** @type {Record<string, Tone>} */
  let tones = {};

  function readTones() {
    const style = getComputedStyle(document.documentElement);
    const color = (/** @type {string} */ name, /** @type {string} */ part) =>
      parseHex(style.getPropertyValue(`--tone-${name}-${part}`));
    tones = Object.fromEntries(
      TONE_NAMES.map((name) => [
        name,
        {
          bg: color(name, 'bg'),
          fg: color(name, 'fg'),
          fg2: color(name, 'fg2'),
          acc: color(name, 'acc'),
          acc2: color(name, 'acc2'),
        },
      ]),
    );
  }

  /** @param {{ from: string, to: string, t: number }} tone */
  function applyTone({ from, to, t }) {
    const key = `${from}|${to}|${t.toFixed(3)}`;
    if (key === lastTone || !tones[from] || !tones[to]) return;
    lastTone = key;
    for (const part of /** @type {const} */ (['bg', 'fg', 'fg2', 'acc', 'acc2'])) {
      stage.style.setProperty(`--${part}`, toCss(mixRgb(tones[from][part], tones[to][part], t)));
    }
  }

  /** Posición del centro de un elemento respecto a la pista (sin su desplazamiento de paralaje). */
  function measureDrifts() {
    const trackRect = track.getBoundingClientRect();
    const scroll = window.scrollY;
    drifts = findAll(root, '[data-parallax]', HTMLElement).map((el) => {
      el.style.translate = '';
      const rect = el.getBoundingClientRect();
      return {
        el,
        k: Number(el.dataset.parallax) || 0,
        cx: rect.left - trackRect.left + rect.width / 2,
        cy: rect.top + scroll + rect.height / 2,
      };
    });
  }

  function measure() {
    const { compact, vw, vh } = getMetrics();
    const want = !compact && !reduced;
    let changed = false;
    if (want !== trackMode) {
      trackMode = want;
      root.classList.toggle('history--track', want);
      root.style.removeProperty('--history-length');
      length = -1;
      changed = true;
    }
    if (trackMode) {
      readTones();
      maxX = Math.max(0, track.scrollWidth - vw);
      const wanted = Math.round(maxX + vh);
      if (wanted !== length) {
        length = wanted;
        root.style.setProperty('--history-length', `${wanted}px`);
        changed = true;
      }
      const trackRect = track.getBoundingClientRect();
      // Posiciones respecto a la pista: `offsetLeft` sería relativo al padre más cercano.
      panels = panelEls.map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          left: rect.left - trackRect.left,
          width: rect.width,
          tone: el.dataset.tone ?? 'paper',
        };
      });
      stitched = slots.flatMap((slot, i) => {
        const ornament = mountOrnament(slot, 500 + i, data, cellFor(false));
        if (!ornament) return [];
        const rect = slot.getBoundingClientRect();
        return [{ ornament, cx: rect.left - trackRect.left + rect.width / 2 }];
      });
    } else {
      track.style.transform = '';
      stitched = [];
    }
    measureDrifts();
    const block = getMetrics().blocks.find((b) => b.id === 'historia');
    section.start = block?.top ?? 0;
    section.end = block?.bottom ?? 0;
    const title = lineEls[0];
    lettersTop = title
      ? section.start + (title.getBoundingClientRect().top - stage.getBoundingClientRect().top)
      : section.start;
    if (reduced) for (const el of drifts) el.el.style.translate = '';
    return changed;
  }

  /** @param {ScrollState} state */
  function updateTrack(state) {
    const { vw } = getMetrics();
    const x = trackX(state.y, section.start, maxX);
    track.style.transform = `translate3d(${-x}px, 0, 0)`;
    applyTone(toneAt(panels, x + vw / 2, vw * TONE_BAND));
    for (const d of drifts) {
      const rel = (d.cx - x - vw / 2) / vw;
      if (Math.abs(rel) < 1.6)
        d.el.style.translate = `${parallaxX(d.cx, x, vw, d.k).toFixed(1)}px 0`;
    }
    spinners.forEach((el, i) => {
      el.style.rotate = `${((x * SPIN * (i % 2 ? -1 : 1)) % 360).toFixed(1)}deg`;
    });
    for (const s of stitched) {
      const p = Math.max(s.ornament.progress, ornamentProgress(s.cx - x, vw));
      if (p !== s.ornament.progress) {
        s.ornament.progress = p;
        s.ornament.layer.advance(p);
      }
    }
    // Las letras del título se juntan al llegar a la sección.
    applyLetters(letters, offsets, range(state.y, section.start - state.vh * 0.85, section.start));
  }

  /** @param {ScrollState} state */
  function updateVertical(state) {
    applyLetters(
      letters,
      offsets,
      range(state.y, lettersTop - state.vh * 0.9, lettersTop - state.vh * 0.45),
    );
    for (const d of drifts) {
      const dy = -(d.cy - (state.y + state.vh / 2)) * d.k * 0.35;
      if (Math.abs(dy) < state.vh) d.el.style.translate = `0 ${dy.toFixed(1)}px`;
    }
    spinners.forEach((el, i) => {
      el.style.rotate = `${((state.y * SPIN * 0.7 * (i % 2 ? -1 : 1)) % 360).toFixed(1)}deg`;
    });
  }

  const section = {
    id: 'historia',
    start: 0,
    end: 0,
    measure,
    /** @param {ScrollState} state */
    update(state) {
      if (trackMode) updateTrack(state);
      else if (!reduced) updateVertical(state);
    },
    isTrack: () => trackMode,
  };
  return section;
}
