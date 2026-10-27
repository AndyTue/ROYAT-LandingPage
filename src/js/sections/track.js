// @ts-check
import { clamp, range } from '../core/motion.js';
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
} from './track-math.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('../features/ornaments.js').OrnamentData} OrnamentData
 * @typedef {import('./track-math.js').Panel} Panel
 * @typedef {{ el: HTMLElement, k: number, cx: number, cy: number }} Drift
 * @typedef {{ bg: import('./track-math.js').Rgb, fg: import('./track-math.js').Rgb, fg2: import('./track-math.js').Rgb, acc: import('./track-math.js').Rgb, acc2: import('./track-math.js').Rgb }} Tone
 */

/** Tonos de panel que usa la pista (DESIGN-TOKENS). */
const TONE_NAMES = ['navy', 'paper', 'sand', 'red', 'cream'];
/** Grados de giro de un vinilo por px de recorrido. */
const SPIN = 0.18;
/** Grados que rueda cada «o» del glosario por px de recorrido. */
const ROLL = 0.25;

/**
 * Pista horizontal fija (Historia e Integrantes): en escritorio con JS y movimiento, el escenario
 * fija la pantalla y el contenido se recorre de lado; en móvil, sin JS o con reduced-motion
 * queda en vertical (HIS-3, HIS-4, INT-*). Cada panel (`[data-tone]`) aporta su tono de fondo.
 * @param {{
 *   id: string,
 *   root: HTMLElement,
 *   data: OrnamentData,
 *   getMetrics: () => Metrics,
 *   reduced: boolean,
 * }} options
 * @returns {import('../core/engine.js').Section & { isTrack(): boolean }}
 */
export function createTrack({ id, root, data, getMetrics, reduced }) {
  const stage = find(root, '[data-track-stage]', HTMLElement);
  const track = find(root, '[data-track-rail]', HTMLElement);
  const panelEls = findAll(root, '[data-tone]', HTMLElement);
  const slots = findAll(root, '[data-ornament]', HTMLElement);
  const spinners = findAll(root, '[data-spin]', HTMLElement);
  const rollers = findAll(root, '[data-roll]', HTMLElement);
  const glossaryEl = root.querySelector('.glossary');
  const lineEls = findAll(root, '[data-letters]', HTMLElement);
  const letters = reduced ? [] : splitLetters(lineEls);
  const offsets = letters.map((_, i) => scatterOf(i));
  // Las letras del glosario entran con su propio avance (móvil: desde los costados, al llegar).
  const inGlossary = letters.map((l) => Boolean(glossaryEl?.contains(l)));
  const titleLetters = letters.filter((_, i) => !inGlossary[i]);
  const titleOffsets = offsets.filter((_, i) => !inGlossary[i]);
  const glossLetters = letters.filter((_, i) => inGlossary[i]);
  const glossOffsets = glossLetters.map((_, i) => ({ ...scatterOf(i, 11), y: 0 }));

  let trackMode = false;
  let length = -1;
  /** @type {Panel[]} */
  let panels = [];
  /** @type {Drift[]} */
  let drifts = [];
  /** @type {{ ornament: NonNullable<ReturnType<typeof mountOrnament>>, cx: number }[]} */
  let stitched = [];
  let lettersTop = 0;
  /** Centro de cada «o» rodante respecto a la pista, y tramo vertical del glosario (móvil). */
  let rollerX = /** @type {number[]} */ ([]);
  let glossaryTop = 0;
  let glossaryRun = 1;
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
      root.classList.toggle('track--on', want);
      root.style.removeProperty('--track-length');
      length = -1;
      changed = true;
    }
    if (trackMode) {
      readTones();
      maxX = Math.max(0, track.scrollWidth - vw);
      const wanted = Math.round(maxX + vh);
      if (wanted !== length) {
        length = wanted;
        root.style.setProperty('--track-length', `${wanted}px`);
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
    rollers.forEach((el) => (el.style.rotate = ''));
    const trackLeft = track.getBoundingClientRect().left;
    rollerX = rollers.map((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left - trackLeft + rect.width / 2;
    });
    if (glossaryEl) {
      const rect = glossaryEl.getBoundingClientRect();
      glossaryTop = rect.top + window.scrollY;
      glossaryRun = Math.max(1, rect.height - vh);
    }
    const block = getMetrics().blocks.find((b) => b.id === id);
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
    // Las «o» de ¡Preciosooo! ruedan con el recorrido y el símbolo ROYAT llega derecho.
    rollers.forEach((el, i) => {
      el.style.rotate =
        el.dataset.roll === 'symbol'
          ? `${(clamp((rollerX[i] - x - vw / 2) / vw, 0, 2) * 360).toFixed(1)}deg`
          : `${((rollerX[i] - x) * ROLL).toFixed(1)}deg`;
    });
    // Las letras del título se juntan al llegar a la sección.
    applyLetters(
      titleLetters,
      titleOffsets,
      range(state.y, section.start - state.vh * 0.85, section.start),
    );
    // La palabra del glosario se junta al entrar por la derecha.
    applyLetters(
      glossLetters,
      glossOffsets,
      rollerX.length ? range(rollerX[0] - x, vw * 1.5, vw * 0.8) : 1,
    );
  }

  /** @param {ScrollState} state */
  function updateVertical(state) {
    applyLetters(
      titleLetters,
      titleOffsets,
      range(state.y, lettersTop - state.vh * 0.9, lettersTop - state.vh * 0.45),
    );
    applyLetters(
      glossLetters,
      glossOffsets,
      range(state.y, glossaryTop - state.vh * 0.6, glossaryTop + state.vh * 0.2),
    );
    for (const d of drifts) {
      const dy = -(d.cy - (state.y + state.vh / 2)) * d.k * 0.35;
      if (Math.abs(dy) < state.vh) d.el.style.translate = `0 ${dy.toFixed(1)}px`;
    }
    spinners.forEach((el, i) => {
      el.style.rotate = `${((state.y * SPIN * 0.7 * (i % 2 ? -1 : 1)) % 360).toFixed(1)}deg`;
    });
    rollers.forEach((el) => {
      el.style.rotate =
        el.dataset.roll === 'symbol'
          ? `${((1 - range(state.y, glossaryTop, glossaryTop + glossaryRun)) * 360).toFixed(1)}deg`
          : `${(state.y * ROLL).toFixed(1)}deg`;
    });
  }

  /**
   * Lleva el scroll vertical a donde la pista deja `el` a la vista. Sin esto, enfocar un
   * elemento o seguir un ancla dentro de la pista desplazaría el escenario (`overflow: hidden`
   * también se desplaza por código) y la pista quedaría desalineada.
   * @param {HTMLElement} el
   */
  function reveal(el) {
    stage.scrollLeft = 0;
    const { vw } = getMetrics();
    const trackRect = track.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const center = rect.left - trackRect.left + rect.width / 2;
    window.scrollTo({ top: section.start + clamp(center - vw / 2, 0, maxX) });
  }

  stage.addEventListener('scroll', () => {
    if (trackMode && stage.scrollLeft) stage.scrollLeft = 0;
  });
  stage.addEventListener('focusin', (event) => {
    if (trackMode && event.target instanceof HTMLElement) reveal(event.target);
  });
  root.addEventListener('click', (event) => {
    if (!trackMode || !(event.target instanceof Element)) return;
    const link = event.target.closest('a[href^="#"]');
    const target = link && document.getElementById(link.getAttribute('href')?.slice(1) ?? '');
    if (!target || !stage.contains(target)) return;
    event.preventDefault();
    reveal(target);
    history.replaceState(null, '', link.getAttribute('href'));
  });

  const section = {
    id,
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
