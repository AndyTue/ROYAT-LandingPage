// @ts-check
import { html } from './html.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * Navegación (NAV-3): enlaces reales a cada sección, que funcionan sin JS.
 * @param {RenderContext} ctx
 */
export function nav({ content }) {
  const { site, ui } = content;
  const items = site.nav.map(
    (/** @type {{ id: string, label: string }} */ item) =>
      html`<li><a class="nav__link" href="#${item.id}">${item.label}</a></li>`,
  );
  return html`<header class="site-header">
    <nav class="nav" aria-label="${ui.nav.label}">
      <ol class="nav__list">
        ${items}
      </ol>
    </nav>
  </header>`;
}
