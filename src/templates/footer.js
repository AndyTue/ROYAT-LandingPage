// @ts-check
import { html } from './html.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * Pie de página (FOO-1).
 * @param {RenderContext} ctx
 */
export function footer({ content }) {
  const { site, ui } = content;
  return html`<footer class="site-footer">
    <p class="site-footer__line"><b>${ui.footer.brand}</b> · ${site.footer.line}</p>
    <p class="site-footer__credit">
      <a href="${site.footer.credit.url}" target="_blank" rel="noopener"
        >${site.footer.credit.label} <span class="sr-only">${ui.contact.newTab}</span></a
      >
    </p>
  </footer>`;
}
