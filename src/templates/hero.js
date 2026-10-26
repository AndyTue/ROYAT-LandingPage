// @ts-check
import { stitchSvg } from '../js/stitch/svg.js';
import { html, raw } from './html.js';
import { picture } from './partials/picture.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * Hero (HERO-1…4): `<h1>` real oculto a la vista, logo bordado en SVG estático (el canvas
 * animado lo reemplaza en F5) y la foto del grupo, que es el LCP.
 * @param {RenderContext} ctx
 */
export function hero(ctx) {
  const { site, ui } = ctx.content;
  const { patterns } = ctx;
  const logo = stitchSvg(patterns.logo, patterns.pal, {
    id: 'hero-logo',
    label: ui.hero.logoLabel,
    className: 'hero__logo',
  });
  return html`<section id="inicio" class="hero" aria-labelledby="hero-title">
    <h1 id="hero-title" class="sr-only">${site.name}</h1>
    ${raw(logo)}
    ${picture(ctx, {
      src: site.heroPhoto.src,
      alt: site.heroPhoto.alt,
      sizes: '(width >= 92rem) 90rem, calc(100vw - 2rem)',
      eager: true,
      className: 'hero__photo',
    })}
  </section>`;
}
