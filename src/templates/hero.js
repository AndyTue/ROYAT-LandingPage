// @ts-check
import { stitchSvg } from '../js/stitch/svg.js';
import { html, raw } from './html.js';
import { picture } from './partials/picture.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * Hero (HERO-1…4, MOV-1). El HTML ya trae la composición final (logo bordado en SVG y la foto
 * del grupo) para que se lea sin JS; con JS los canvases bordan el logo, las rosas o las
 * guirnaldas y mueven la escena con el scroll (`sections/hero.js`).
 * @param {RenderContext} ctx
 */
export function hero(ctx) {
  const { site, ui } = ctx.content;
  const { patterns } = ctx;
  const logo = stitchSvg(patterns.logo, patterns.pal, {
    id: 'hero-logo',
    label: ui.hero.logoLabel,
    className: 'hero__static',
    extra: ' data-hero-static',
  });
  return html`<section id="inicio" class="hero" aria-labelledby="hero-title" data-hero>
    <div class="hero__stage" data-hero-stage>
      <h1 id="hero-title" class="sr-only">${site.name}</h1>
      <canvas class="hero__canvas hero__rose" data-hero-rose="left" aria-hidden="true" hidden></canvas>
      <canvas class="hero__canvas hero__rose" data-hero-rose="right" aria-hidden="true" hidden></canvas>
      <canvas class="hero__canvas hero__garland" data-hero-garland="top" aria-hidden="true" hidden></canvas>
      <canvas class="hero__canvas hero__garland" data-hero-garland="bottom" aria-hidden="true" hidden></canvas>
      ${raw(logo)}
      <canvas class="hero__canvas hero__logo" data-hero-logo role="img" aria-label="${ui.hero.logoLabel}" hidden></canvas>
      ${picture(ctx, {
        src: site.heroPhoto.src,
        alt: site.heroPhoto.alt,
        sizes: '(width >= 92rem) 90rem, 92vw',
        eager: true,
        className: 'hero__crew',
        data: { 'data-hero-crew': '' },
      })}
      <p class="hero__cue" data-hero-cue aria-hidden="true">${ui.hero.scrollCue}<i></i></p>
      <button class="hero__skip" type="button" data-hero-skip hidden>${ui.hero.skipIntro}</button>
    </div>
  </section>`;
}
