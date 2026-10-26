// @ts-check
import { createEngine } from './core/engine.js';
import { bus } from './core/events.js';
import { createLayout } from './core/layout.js';
import { prefersReducedMotion } from './core/motion.js';
import { createNav } from './features/nav.js';
import { createOrnaments } from './features/ornaments.js';
import { createCurtain } from './features/transition.js';
import { find } from './lib/dom.js';
import { initContact } from './sections/contact.js';
import { createHero } from './sections/hero.js';
import { createTrack } from './sections/track.js';
import { loadMotifs, loadPatterns } from './stitch/data.js';

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
guard('curtain', () => {
  createCurtain(find(document, '[data-curtain]', HTMLElement), { reduced });
});
engine.snap();
engine.start();

// 4. El bordado necesita sus datos: se piden aparte, sin retrasar el primer pintado.
Promise.all([loadPatterns(), loadMotifs()])
  .then(([patterns, motifs]) => {
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
