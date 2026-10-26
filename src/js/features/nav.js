// @ts-check
import { activeSection } from '../core/layout.js';
import { clamp } from '../core/motion.js';
import { find, findAll } from '../lib/dom.js';
import { fill } from '../lib/format.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('../core/events.js').Bus} Bus
 */

/** Secciones en las que el listón sube para no tapar los discos ni la carta (NAV-2). */
const TOP_SECTIONS = new Set(['discografia', 'contacto']);

/** Elementos que quedan fuera de la interacción mientras el menú móvil está abierto. */
const BACKGROUND = 'main, footer';

/**
 * Navegación en listón (NAV-1…3, MOV-7): marca la sección activa, muestra el progreso del
 * recorrido, cambia de posición y, en móvil, se vuelve un menú en hoja inferior.
 * @param {{ root: HTMLElement, bus: Bus, getMetrics: () => Metrics, announce: string }} options
 *   `announce` es la plantilla del aviso a lectores de pantalla (`{label}`).
 */
export function createNav({ root, bus, getMetrics, announce }) {
  const list = find(root, '[data-nav-list]', HTMLElement);
  const toggle = find(root, '[data-nav-toggle]', HTMLButtonElement);
  const close = find(root, '[data-nav-close]', HTMLButtonElement);
  const thread = find(root, '[data-nav-fill]', HTMLElement);
  const status = find(root, '[data-nav-status]', HTMLElement);
  const links = findAll(root, '[data-nav-link]', HTMLAnchorElement);
  const background = [...document.querySelectorAll(BACKGROUND)];

  /** @type {string | null} */
  let active = null;
  let progress = -1;
  let ready = false;
  let isOpen = false;

  /** @param {string} id */
  function setActive(id) {
    active = id;
    for (const link of links) {
      const current = link.dataset.navLink === id;
      link.classList.toggle('is-active', current);
      if (current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    root.classList.toggle('nav--top', TOP_SECTIONS.has(id));
    const label = links.find((l) => l.dataset.navLink === id)?.dataset.label ?? id;
    status.textContent = fill(announce, { label });
    bus.emit('section:change', { id });
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    root.classList.add('nav--open');
    toggle.setAttribute('aria-expanded', 'true');
    for (const el of background) el.setAttribute('inert', '');
    (links.find((l) => l.dataset.navLink === active) ?? links[0]).focus();
  }

  /** @param {{ restoreFocus?: boolean }} [options] */
  function closeMenu({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove('nav--open');
    toggle.setAttribute('aria-expanded', 'false');
    for (const el of background) el.removeAttribute('inert');
    if (restoreFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => (isOpen ? closeMenu() : open()));
  close.addEventListener('click', () => closeMenu());
  // Un clic en el fondo oscuro (fuera de la hoja) cierra el menú.
  root.addEventListener('click', (event) => {
    if (event.target === root) closeMenu();
  });
  // Al elegir una sección el navegador salta al ancla; el menú se cierra sin robar el foco.
  list.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a'))
      closeMenu({ restoreFocus: false });
  });
  root.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    } else if (event.key === 'Tab') {
      // Foco atrapado dentro de la hoja.
      const focusable = [...links, close];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  // Al pasar a escritorio con el menú abierto, se cierra.
  window.matchMedia('(width >= 48em)').addEventListener('change', (event) => {
    if (event.matches) closeMenu({ restoreFocus: false });
  });
  bus.on('intro:done', () => {
    ready = true;
    root.classList.add('nav--ready');
  });

  return {
    /** @param {ScrollState} state */
    update(state) {
      const { blocks, total, vh } = getMetrics();
      if (!ready && state.y > 8) {
        ready = true;
        root.classList.add('nav--ready');
      }
      const id = activeSection(blocks, state.y, vh);
      if (id && id !== active) setActive(id);
      const max = Math.max(1, total - vh);
      const p = clamp(state.y / max);
      if (p !== progress) {
        progress = p;
        thread.style.transform = `translate3d(${(p - 1) * 100}%, 0, 0)`;
      }
    },
    open,
    close: closeMenu,
  };
}
