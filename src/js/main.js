// @ts-check
import { createEngine } from './core/engine.js';
import { bus } from './core/events.js';
import { createLayout } from './core/layout.js';
import { prefersReducedMotion } from './core/motion.js';
import { createNav } from './features/nav.js';
import { createPlayer } from './features/player.js';
import { createPlayerBar } from './features/player-bar.js';
import { createOrnaments } from './features/ornaments.js';
import { createCurtain } from './features/transition.js';
import { find } from './lib/dom.js';
import { initContact } from './sections/contact.js';
import { createDiscography } from './sections/discography.js';
import { createHero } from './sections/hero.js';
import { createMap } from './sections/map.js';
import { createTrack } from './sections/track.js';
import { loadDiscs, loadMap, loadMotifs, loadPatterns } from './stitch/data.js';

// El CSS sin esta clase muestra el layout estático; con ella, las secciones pueden animarse.
document.documentElement.classList.add('js');

/**
 * Cada módulo se inicia dentro de su propio `try`: si uno falla, la página se queda en su
 * versión estática y el resto sigue funcionando (STANDARDS §3).
 * @param {string} name
 * @param {() => void} start
 */
function guard(name, start) {
  try {
    start();
  } catch (error) {
    if (import.meta.env.DEV) console.error(`[${name}]`, error);
  }
}

const reduced = prefersReducedMotion();

// 1. El formulario es lo más importante para el cliente: se activa de inmediato.
const form = document.querySelector('[data-contact-form]');
if (form instanceof HTMLFormElement) {
  try {
    initContact(form);
  } catch (error) {
    form.classList.add('letter__form--fallback');
    form.noValidate = false;
    const text = form.querySelector('textarea[name="text"]');
    if (text instanceof HTMLTextAreaElement) text.disabled = false;
    if (import.meta.env.DEV) console.error(error);
  }
}

// 2. Motor y medición: un solo loop para toda la página.
const engine = createEngine({
  read: () => window.scrollY,
  viewport: () => window.innerHeight,
  schedule: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
  reduced,
});
const ids = [...document.querySelectorAll('[data-nav-link]')].map(
  (link) => /** @type {HTMLElement} */ (link).dataset.navLink ?? '',
);
const layout = createLayout({
  win: window,
  doc: document,
  ids,
  // Una sección puede cambiar el layout al medirse (pista horizontal): se mide una vez más.
  onChange: () => {
    if (engine.measure()) layout.measure();
  },
});
const getMetrics = () => layout.metrics;
layout.measure();

// 3. Navegación y cortina: no necesitan los patrones de bordado.
guard('nav', () => {
  const root = find(document, '[data-nav]', HTMLElement);
  const text = /** @type {HTMLElement} */ (find(root, '[data-nav-status]', HTMLElement));
  const nav = createNav({
    root,
    bus,
    getMetrics,
    announce: text.dataset.announce ?? '{label}',
  });
  engine.watch((state) => nav.update(state));
});
/** @type {ReturnType<typeof createCurtain> | null} */
let curtain = null;
guard('curtain', () => {
  curtain = createCurtain(find(document, '[data-curtain]', HTMLElement), { reduced });
});
engine.snap();
engine.start();

// 4. El bordado necesita sus datos: se piden aparte, sin retrasar el primer pintado.
Promise.all([loadPatterns(), loadMotifs(), loadMap(), loadDiscs()])
  .then(([patterns, motifs, map, discs]) => {
    guard('hero', () => {
      const root = find(document, '[data-hero]', HTMLElement);
      const hero = createHero({ root, patterns, getMetrics, reduced });
      engine.add(hero);
    });
    const ornamentData = { pal: patterns.pal, motifs: motifs.motifs, bands: motifs.bands };
    // Historia e Integrantes son pistas horizontales en escritorio.
    /** @type {Map<Element, { isTrack(): boolean }>} */
    const tracks = new Map();
    for (const root of document.querySelectorAll('[data-track]')) {
      guard(`pista ${/** @type {HTMLElement} */ (root).dataset.track}`, () => {
        const id = /** @type {HTMLElement} */ (root).dataset.track ?? '';
        const section = createTrack({
          id,
          root: /** @type {HTMLElement} */ (root),
          data: ornamentData,
          getMetrics,
          reduced,
        });
        tracks.set(root, section);
        engine.add(section);
      });
    }
    guard('mapa', () => {
      const root = find(document, '[data-presence]', HTMLElement);
      const uiText = JSON.parse(root.dataset.mapText ?? '{}');
      engine.add(
        createMap({
          root,
          grid: map.grid,
          places: map.places,
          states: map.states,
          text: uiText,
          getMetrics,
          reduced,
        }),
      );
    });
    guard('discografia', () => {
      const root = find(document, '[data-disco]', HTMLElement);
      const text = JSON.parse(root.dataset.discoText ?? '{}');
      const audio = new Audio();
      const player = createPlayer({
        audio,
        baseUrl: root.dataset.audioBase ?? '/audio',
        discs,
        bus,
      });
      const section = createDiscography({
        root,
        discs,
        player,
        curtain: /** @type {NonNullable<typeof curtain>} */ (curtain),
        text,
        getMetrics,
        reduced,
      });
      engine.add(section);
      // La barra va en <body>: así sigue activa cuando la ficha de detalle inhabilita <main>.
      const bar = find(document, '[data-player]', HTMLElement);
      document.body.append(bar);
      createPlayerBar({
        root: bar,
        player,
        discs,
        covers: section.covers,
        text: text.player,
        onInfo: (index) => section.openDetail(index),
        onNow: (index) => section.goTo(index),
      });
    });
    guard('ornaments', () => {
      engine.add(
        createOrnaments({
          root: document,
          data: ornamentData,
          getMetrics,
          reduced,
          // Los ornamentos dentro de una pista horizontal los borda la propia pista.
          skip: (slot) => {
            const root = slot.closest('[data-track]');
            return Boolean(root && tracks.get(root)?.isTrack());
          },
        }),
      );
    });
    layout.measure();
  })
  .catch((error) => {
    if (import.meta.env.DEV) console.error('[bordado]', error);
  });
