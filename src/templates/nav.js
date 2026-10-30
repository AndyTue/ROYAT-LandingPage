// @ts-check
import { html } from './html.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/**
 * Navegación (NAV-1…3, MOV-7): enlaces reales a cada sección, que funcionan sin JS. Con JS es
 * un listón flotante en escritorio y un menú en hoja inferior en móvil.
 * @param {RenderContext} ctx
 */
export function nav({ content }) {
  const { site, ui } = content;
  const items = site.nav.map(
    (/** @type {{ id: string, label: string }} */ item, /** @type {number} */ index) => html`<li>
      <a class="nav__link" href="#${item.id}" data-nav-link="${item.id}" data-label="${index === 0 ? ui.nav.home : item.label}">
        <span class="nav__num" aria-hidden="true">${ROMAN[index]}</span>
        ${
          index === 0
            ? html`<span class="nav__brand">${item.label}</span><span class="nav__home">${ui.nav.home}</span>`
            : html`<span class="nav__text">${item.label}</span>`
        }
      </a>
    </li>`,
  );
  return html`<header class="site-header" data-nav>
    <nav class="nav" id="nav-menu" aria-label="${ui.nav.label}" data-nav-list>
      <p class="nav__title" aria-hidden="true">${ui.nav.goTo}</p>
      <ol class="nav__list">
        ${items}
      </ol>
      <button class="nav__close" type="button" data-nav-close>
        ${ui.nav.close}
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2l8 8M10 2l-8 8"/></svg>
      </button>
    </nav>
    <span class="nav__thread" aria-hidden="true"><i class="nav__fill" data-nav-fill></i></span>
    <div class="nav__prog" data-nav-prog>
      <div class="nav__prog-line"><span class="nav__prog-fill" data-nav-prog-fill></span>${site.nav.map(
        (/** @type {{ id: string, label: string }} */ item, /** @type {number} */ index) =>
          html`<button type="button" class="nav__pin" data-nav-pin="${item.id}" aria-label="${ui.nav.goTo} ${index === 0 ? ui.nav.home : item.label}"></button>`,
      )}</div>
    </div>
    <button class="nav__toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="nav-menu" aria-label="${ui.nav.menu}">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M5 8h14M5 12h14M5 16h9" stroke-dasharray="2 3"/></svg>
    </button>
    <p class="sr-only" role="status" data-nav-status data-announce="${ui.nav.announce}"></p>
  </header>`;
}
