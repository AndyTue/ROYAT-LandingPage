// @ts-check
import { stitchBandSvg } from '../js/stitch/svg.js';
import { html, raw } from './html.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * Pie de página (FOO-1): banda de rombos bordada, nombre y crédito.
 * @param {RenderContext} ctx
 */
export function footer(ctx) {
  const { site, ui } = ctx.content;
  const { patterns } = ctx;
  const band = stitchBandSvg(patterns.bands.rombos, patterns.pal, {
    id: 'footer-band',
    cell: 6,
    className: 'site-footer__band site-footer__band--svg',
  });
  return html`<footer class="site-footer">
    ${raw(band)}
    <canvas class="site-footer__band site-footer__band--canvas" data-hem="rombos" aria-hidden="true" hidden></canvas>
    <div class="site-footer__body">
      <p class="site-footer__line"><b class="site-footer__brand">${ui.footer.brand}</b>${site.footer.line}</p>
      <p class="site-footer__credit">
        <a href="${site.footer.credit.url}" target="_blank" rel="noopener"
          >${site.footer.credit.label} <span class="sr-only">${ui.contact.newTab}</span></a
        >
      </p>
    </div>
  </footer>`;
}
