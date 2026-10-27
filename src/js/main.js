// @ts-check
import { createEngine } from './core/engine.js';
import { bus } from './core/events.js';
import { createLayout } from './core/layout.js';
import { prefersReducedMotion } from './core/motion.js';
import { createFovi } from './features/fovi.js';
import { createNav } from './features/nav.js';
import { createPlayer } from './features/player.js';
import { createPlayerBar } from './features/player-bar.js';
import { createOrnaments } from './features/ornaments.js';
import { createCurtain } from './features/transition.js';
import { find } from './lib/dom.js';
import { initContact } from './sections/contact.js';
import { createDiscography } from './sections/discography.js';
import { createJourney } from './sections/journey.js';
import { drawHem, hemCell } from './stitch/hem.js';
import { createMap } from './sections/map.js';
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

/** @type {ReturnType<typeof createJourney> | null} */
let journey = null;
/** @type {ReturnType<typeof createDiscography> | null} */
let disco = null;

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
  // Historia e Integrantes están dentro de la pista fija: su inicio lo da el recorrido.
  resolve: (id, vh) => journey?.blockTop(id, vh) ?? null,
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
    // Historia e Integrantes viven dentro de la pista: su scroll lo calcula el recorrido.
    yFor: (id) => journey?.yFor(id) ?? null,
    topFrom: () => disco?.topY() ?? null,
  });
  engine.watch((state) => nav.update(state));
});
/** @type {ReturnType<typeof createCurtain> | null} */
let curtain = null;
/** @type {ReturnType<typeof createPlayer> | null} */
let player = null;
guard('curtain', () => {
  curtain = createCurtain(find(document, '[data-curtain]', HTMLElement), { reduced });
});
engine.snap();
engine.start();

// 4. El bordado necesita sus datos: se piden aparte, sin retrasar el primer pintado.
Promise.all([loadPatterns(), loadMotifs(), loadMap(), loadDiscs()])
  .then(([patterns, motifs, map, discs]) => {
    const ornamentData = {
      pal: patterns.pal,
      motifs: motifs.motifs,
      bands: motifs.bands,
      logo: patterns.logo,
    };
    guard('recorrido', () => {
      const root = find(document, '[data-journey]', HTMLElement);
      journey = createJourney({ root, patterns, data: ornamentData, getMetrics, reduced });
      engine.add(journey);
    });
    // Guirnaldas de Presencia, Discografía y Contacto: en escritorio, bordadas como en el prototipo.
    guard('guirnaldas', () => {
      const hems = [...document.querySelectorAll('canvas[data-hem]')];
      engine.add({
        id: 'guirnaldas',
        start: 0,
        end: 0,
        measure() {
          const { vw, vh, compact } = getMetrics();
          for (const c of hems) {
            const canvas = /** @type {HTMLCanvasElement} */ (c);
            canvas.hidden = compact;
            if (compact) continue;
            // `data-hem="rombos"` es la banda del pie (celda fija de 6 px a 1536×800).
            const band = canvas.dataset.hem ? motifs.bands[canvas.dataset.hem] : null;
            const cell = band ? 6 * Math.min(vh / 800, vw / 1100) : hemCell(vw, vh);
            drawHem(canvas, band ?? patterns.hem, patterns.pal, cell, { exact: Boolean(band) });
            // La de Discografía se esconde media guirnalda bajo el borde (prototipo `drawHem`).
            if (canvas.closest('[data-disco]')) canvas.style.marginTop = `${-6 * cell}px`;
          }
        },
        update() {},
      });
    });
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
      player = createPlayer({
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
      disco = section;
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
    guard('fovi', () => {
      const root = find(document, '[data-fovi]', HTMLElement);
      const nowPlaying = () => {
        const state = player?.state;
        if (!state || state.disc === null || !state.playing) return null;
        return discs[state.disc].tracks[state.track].title;
      };
      engine.add(
        createFovi({
          root,
          bubble: find(document, '[data-fovi-bubble]', HTMLElement),
          fx: find(document, '[data-fovi-fx]', HTMLElement),
          live: find(document, '[data-fovi-live]', HTMLElement),
          data: JSON.parse(root.dataset.foviLines ?? '{}'),
          bus,
          doc: document,
          getMetrics,
          nowPlaying,
          reduced,
        }),
      );
    });
    guard('ornaments', () => {
      engine.add(
        createOrnaments({
          root: document,
          data: ornamentData,
          getMetrics,
          reduced,
          // Los ornamentos de la pista los borda la propia pista.
          skip: (slot) => Boolean(slot.closest('[data-journey]') && journey?.isLive()),
        }),
      );
    });
    layout.measure();
  })
  .catch((error) => {
    if (import.meta.env.DEV) console.error('[bordado]', error);
  });
