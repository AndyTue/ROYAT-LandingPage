// @ts-check
import { clamp, range } from '../core/motion.js';
import { find } from '../lib/dom.js';
import { createRng } from '../lib/random.js';
import { orderStitches } from '../stitch/order.js';
import { parsePattern, rotateRows } from '../stitch/patterns.js';
import { HERO_JITTER, HERO_ORDERS } from '../stitch/presets.js';
import { createStitchLayer, setupCanvas } from '../stitch/renderer.js';
import { heroFrame, heroGeometry, TIMELINE } from './hero-layout.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('../stitch/renderer.js').StitchLayer} StitchLayer
 * @typedef {import('./hero-layout.js').Box} Box
 * @typedef {{ pal: string[], left: string[], right: string[], logo: string[] }} HeroPatterns
 */

/** Semilla del bordado: el año de fundación, para que salga igual en cada visita. */
const SEED = 2018;

/**
 * Hero: intro bordada por tiempo y, después, escena movida por el scroll (HERO-1…4, MOV-1).
 * @param {{
 *   root: HTMLElement,
 *   patterns: HeroPatterns,
 *   getMetrics: () => Metrics,
 *   reduced: boolean,
 * }} options
 * @returns {import('../core/engine.js').Section & { finish(): void }}
 */
export function createHero({ root, patterns, getMetrics, reduced }) {
  const stage = find(root, '[data-hero-stage]', HTMLElement);
  const crew = find(root, '[data-hero-crew]', HTMLElement);
  const staticLogo = find(root, '[data-hero-static]', SVGElement);
  const logoCanvas = find(root, '[data-hero-logo]', HTMLCanvasElement);
  const cue = find(root, '[data-hero-cue]', HTMLElement);
  const skip = find(root, '[data-hero-skip]', HTMLButtonElement);
  const canvases = {
    left: find(root, '[data-hero-rose="left"]', HTMLCanvasElement),
    right: find(root, '[data-hero-rose="right"]', HTMLCanvasElement),
    top: find(root, '[data-hero-garland="top"]', HTMLCanvasElement),
    bottom: find(root, '[data-hero-garland="bottom"]', HTMLCanvasElement),
  };
  const crewImg = find(crew, 'img', HTMLImageElement);
  const crewAspect = Number(crewImg.getAttribute('width')) / Number(crewImg.getAttribute('height'));

  /** @type {ReturnType<typeof heroGeometry>} */
  let geo = heroGeometry({ W: 1536, H: 800, compact: false, crewAspect });
  /** @type {Partial<Record<'logo' | 'left' | 'right' | 'top' | 'bottom', StitchLayer>>} */
  let layers = {};
  const intro = {
    t0: /** @type {number | null} */ (null),
    t: reduced ? TIMELINE.end : 0,
    done: reduced,
  };
  let scrollProgress = reduced ? 1 : 0;
  let skipRequested = false;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string[]} rows
   * @param {Box} box
   * @param {import('../stitch/order.js').OrderFn} order
   * @param {number} seed
   */
  function mount(canvas, rows, box, order, seed) {
    const pattern = parsePattern(rows, patterns.pal);
    const ctx = setupCanvas(canvas, pattern.w, pattern.h, box.cell, window.devicePixelRatio);
    canvas.style.left = `${box.x}px`;
    canvas.style.top = `${box.y}px`;
    canvas.hidden = false;
    const stitches = orderStitches(pattern.stitches, {
      w: pattern.w,
      h: pattern.h,
      mode: order,
      rng: createRng(SEED + seed),
      jitter: HERO_JITTER,
    });
    return createStitchLayer(ctx, stitches, { cell: box.cell });
  }

  /** Reconstruye canvases y capas para el tamaño actual (se llama al medir, no en el loop). */
  function build() {
    const { compact } = getMetrics();
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    geo = heroGeometry({ W, H, compact, crewAspect });
    layers = {};
    for (const canvas of Object.values(canvases)) canvas.hidden = true;
    layers.logo = mount(logoCanvas, patterns.logo, geo.logo, HERO_ORDERS.logo, 3);
    if (geo.mode === 'roses' && geo.left && geo.right) {
      layers.left = mount(canvases.left, patterns.left, geo.left, HERO_ORDERS.left, 1);
      layers.right = mount(canvases.right, patterns.right, geo.right, HERO_ORDERS.right, 2);
    } else if (geo.top && geo.bottom) {
      // La guirnalda del móvil es la rosa girada: el borde de la tela queda arriba o abajo.
      const top = rotateRows(patterns.left, 'cw');
      const bottom = rotateRows(patterns.right, 'ccw');
      layers.top = mount(canvases.top, top, geo.top, (i, j, w, h) => i / w + j / h / 2, 1);
      layers.bottom = mount(
        canvases.bottom,
        bottom,
        geo.bottom,
        (i, j, w, h) => i / w + (1 - j / h) / 2,
        2,
      );
    }
    crew.style.width = `${geo.crew.w}px`;
    crew.style.bottom = `${geo.crew.bottom}px`;
    staticLogo.setAttribute('hidden', '');
    logoCanvas.setAttribute('aria-label', staticLogo.getAttribute('aria-label') ?? '');
    render();
  }

  /** Dibuja lo que falta y aplica transformaciones: solo `transform` y `opacity`. */
  function render() {
    const frame = heroFrame(geo, { t: intro.t, s: scrollProgress });
    const { roses, logo } = frame.stitch;
    layers.logo?.advance(logo);
    layers.left?.advance(roses);
    layers.right?.advance(roses);
    layers.top?.advance(roses);
    layers.bottom?.advance(roses);

    logoCanvas.style.transform = `translate3d(0, ${frame.logo.ty}px, 0) scale(${frame.logo.scale})`;
    logoCanvas.style.opacity = String(clamp(frame.pop * 3));
    canvases.left.style.transform = `translate3d(${frame.left.tx}px, 0, 0)`;
    canvases.left.style.opacity = String(frame.left.opacity);
    canvases.right.style.transform = `translate3d(${frame.right.tx}px, 0, 0)`;
    canvases.right.style.opacity = String(frame.right.opacity);
    canvases.top.style.transform = `translate3d(0, ${frame.top.ty}px, 0)`;
    canvases.top.style.opacity = String(frame.pop);
    canvases.bottom.style.opacity = String(frame.pop);
    crew.style.transform = `translate3d(0, ${frame.crew.ty}px, 0)`;
    crew.style.opacity = String(frame.crew.opacity);
    cue.style.opacity = String(frame.cue);
  }

  function finishIntro() {
    intro.done = true;
    intro.t = TIMELINE.end;
    section.alwaysTick = false;
    skip.hidden = true;
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
      window.removeEventListener(type, requestSkip);
    }
  }

  /** @param {Event} event */
  function requestSkip(event) {
    if (event instanceof KeyboardEvent && (event.key === 'Tab' || event.key === 'Shift')) return;
    skipRequested = true;
  }

  const section = {
    id: 'inicio',
    start: 0,
    end: 0,
    alwaysTick: !reduced,
    measure() {
      const block = getMetrics().blocks.find((b) => b.id === 'inicio');
      section.start = block?.top ?? 0;
      section.end = block?.bottom ?? 0;
      build();
    },
    /** @param {ScrollState} state */
    update(state) {
      const length = Math.max(1, section.end - section.start - state.vh);
      scrollProgress = range(state.y, section.start, section.start + length);
      if (!intro.done) {
        if (intro.t0 === null) intro.t0 = state.now;
        intro.t = state.now - intro.t0;
        // Quien ya empezó a mover la página no necesita ver la intro completa.
        if (skipRequested || scrollProgress > 0 || intro.t >= TIMELINE.end) finishIntro();
      }
      render();
    },
    finish() {
      skipRequested = true;
    },
    destroy() {
      finishIntro();
    },
  };

  skip.hidden = reduced;
  if (!reduced) {
    skip.addEventListener('click', () => (skipRequested = true));
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
      window.addEventListener(type, requestSkip, { passive: true });
    }
  }
  // Llegar con un ancla (p. ej. #contacto) no debe reproducir una intro que nadie verá.
  if (window.scrollY > window.innerHeight * 0.5) {
    intro.done = true;
    intro.t = TIMELINE.end;
    section.alwaysTick = false;
    skip.hidden = true;
  }
  root.classList.add('hero--live');
  return section;
}
