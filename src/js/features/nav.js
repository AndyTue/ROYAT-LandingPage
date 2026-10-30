// @ts-check
import { activeSection, DESKTOP_QUERY } from '../core/layout.js';
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
 * @param {{
 *   root: HTMLElement,
 *   bus: Bus,
 *   getMetrics: () => Metrics,
 *   announce: string,
 *   yFor?: (id: string) => number | null,
 *   topFrom?: () => number | null,
 * }} options
 *   `announce` es la plantilla del aviso a lectores de pantalla (`{label}`). `yFor` da el
 *   scroll de un destino que no se alcanza con su ancla (Historia e Integrantes en la pista).
 */
export function createNav({
  root,
  bus,
  getMetrics,
  announce,
  yFor = () => null,
  topFrom = () => null,
}) {
  const list = find(root, '[data-nav-list]', HTMLElement);
  const toggle = find(root, '[data-nav-toggle]', HTMLButtonElement);
  const close = find(root, '[data-nav-close]', HTMLButtonElement);
  const thread = find(root, '[data-nav-fill]', HTMLElement);
  const status = find(root, '[data-nav-status]', HTMLElement);
  const links = findAll(root, '[data-nav-link]', HTMLAnchorElement);
  const background = [...document.querySelectorAll(BACKGROUND)];
  // Hilo de progreso de móvil: línea con su avance y un rombo por sección.
  const pins = findAll(root, '[data-nav-pin]', HTMLButtonElement);
  const progFill = find(root, '[data-nav-prog-fill]', HTMLElement);

  /** @type {string | null} */
  let active = null;
  /** @type {Metrics['blocks'] | null} */
  let placed = null;
  let progress = -1;
  let reveal = -1;
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
    if (topFrom() === null) root.classList.toggle('nav--top', TOP_SECTIONS.has(id));
    const label = links.find((l) => l.dataset.navLink === id)?.dataset.label ?? id;
    status.textContent = fill(announce, { label });
    const at = Math.max(
      0,
      pins.findIndex((p) => p.dataset.navPin === id),
    );
    pins.forEach((pin, i) => {
      pin.classList.toggle('is-lit', i <= at);
      pin.classList.toggle('is-current', i === at);
      pin.setAttribute('aria-current', i === at ? 'true' : 'false');
    });
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

  /**
   * Lleva a una sección. El salto nativo del ancla se queda corto con la pista fija y el scroll
   * suave: siempre se calcula el destino (la pista da el suyo; las demás secciones, su posición
   * en el documento).
   * @param {string} id
   * @returns {boolean} `false` si no hay destino y conviene el salto nativo del ancla
   */
  function goTo(id) {
    const target = document.getElementById(id);
    const top = yFor(id) ?? (target ? target.getBoundingClientRect().top + window.scrollY : null);
    if (top === null) return false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', `#${id}`);
    return true;
  }

  toggle.addEventListener('click', () => (isOpen ? closeMenu() : open()));
  close.addEventListener('click', () => closeMenu());
  // Un clic en el fondo oscuro (fuera de la hoja) cierra el menú.
  root.addEventListener('click', (event) => {
    if (event.target === root) closeMenu();
  });
  // Al elegir una sección el navegador salta al ancla; el menú se cierra sin robar el foco.
  list.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link) return;
    closeMenu({ restoreFocus: false });
    if (goTo(/** @type {HTMLElement} */ (link).dataset.navLink ?? '')) event.preventDefault();
  });
  for (const pin of pins) pin.addEventListener('click', () => goTo(pin.dataset.navPin ?? ''));
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
  const desktop = window.matchMedia(DESKTOP_QUERY);
  /** @param {{ matches: boolean }} event */
  const onDesktop = (event) => {
    if (event.matches) closeMenu({ restoreFocus: false });
  };
  // Safari < 14 (y el navegador de la Switch) solo tienen `addListener`.
  if (desktop.addEventListener) desktop.addEventListener('change', onDesktop);
  else desktop.addListener(onDesktop);
  bus.on('intro:done', () => {
    ready = true;
    root.classList.add('nav--ready');
  });

  return {
    /** @param {ScrollState} state */
    update(state) {
      const { blocks, total, vh, compact } = getMetrics();
      if (!ready && state.y > 8) {
        ready = true;
        root.classList.add('nav--ready');
      }
      // En escritorio el listón no aparece dentro del Hero: sale al terminar de recorrerlo
      // (prototipo: de 360 a 520 px de scroll a 1536×800).
      const u = vh / 800;
      const shown = compact ? 1 : clamp((state.y - 360 * u) / (160 * u));
      if (shown !== reveal) {
        reveal = shown;
        root.style.setProperty('--nav-reveal', shown.toFixed(3));
        root.classList.toggle('nav--hidden', shown < 0.5);
      }
      // El listón sube al llegar a la galería de discos (prototipo: yDisco − 45 % de la pantalla).
      const top = topFrom();
      if (top !== null) root.classList.toggle('nav--top', state.y >= top - vh * 0.45);
      const id = activeSection(blocks, state.y, vh);
      if (id && id !== active) setActive(id);
      const max = Math.max(1, total - vh);
      if (blocks !== placed) {
        placed = blocks;
        // Cada rombo va donde su sección pasa a ser la activa (a 40 % de la pantalla).
        for (const pin of pins) {
          const block = blocks.find((b) => b.id === pin.dataset.navPin);
          const at = block ? clamp((block.top - vh * 0.4) / max) : 0;
          pin.style.left = `${(at * 100).toFixed(2)}%`;
        }
      }
      const p = clamp(state.y / max);
      if (p !== progress) {
        progress = p;
        thread.style.transform = `translate3d(${(p - 1) * 100}%, 0, 0)`;
        progFill.style.transform = `scaleX(${p.toFixed(4)})`;
      }
    },
    open,
    close: closeMenu,
  };
}
