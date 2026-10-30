// @ts-check
import { CARDS } from '../js/journey/preciosooo-data.js';
import { pad2 } from '../js/lib/format.js';
import { html } from './html.js';
import { picture } from './partials/picture.js';

/**
 * ¡Preciosooo! móvil vertical (MOV-3b): la palabra en columna, las 6 tarjetas del glosario a los
 * costados y Vocalistas, en una escena fija. Solo se ve en móvil con JS (`.journey--m ~ .prec`);
 * el resto del sitio conserva el glosario y los vocalistas de la pista.
 *
 * @typedef {import('./context.js').RenderContext} RenderContext
 */

/** Cada letra va en su propio `<span>` para dispersarse; los espacios quedan como texto. */
const letters = (/** @type {string} */ text) =>
  [...text].map((c) => (c === ' ' ? ' ' : html`<span class="ch">${c}</span>`));

/** @param {RenderContext} ctx */
function word(ctx) {
  const title = String(ctx.content.glossary.title);
  const head = title.replace(/o+$/, '');
  const os = title.length - head.length;
  const chars = [...head].map(
    (c, i) => html`<span class="ch${i === 0 ? ' cap' : ''}${c === 'i' ? ' ti' : ''}">${c}</span>`,
  );
  const rolling = Array.from(
    { length: Math.max(0, os - 1) },
    () => html`<span class="oo">o</span>`,
  );
  const logo = picture(ctx, {
    src: 'assets-src/brand/simbolo.png',
    alt: '',
    sizes: '40svh',
    className: 'oo logo',
  });
  return html`<h3 class="prec__h" id="prec-word">
    <span class="sr-only">${title}</span
    ><span class="prec__word" data-lt="150" aria-hidden="true">${chars}${rolling}${logo}</span>
  </h3>`;
}

/** @param {RenderContext} ctx */
function cards(ctx) {
  const { items } = ctx.content.glossary;
  return html`<dl class="prec__cards">
    ${items.slice(0, CARDS.length).map(
      (/** @type {{ term: string, text: string }} */ item, /** @type {number} */ i) =>
        html`<div class="card c${CARDS[i].tone}" data-k="${CARDS[i].k}" data-r="${CARDS[i].r}">
          <dt>${item.term}</dt>
          <dd>${item.text}</dd>
        </div>`,
    )}
  </dl>`;
}

/** @param {RenderContext} ctx @param {any} section */
function voices(ctx, section) {
  const { ui } = ctx.content;
  const v = ui.members.vocalists;
  const [a, b, c] = v.titleLines;
  const photo = section.groupPhoto;
  return html`<section
    class="prec__panel"
    data-tone="navy"
    data-prec-voc
    id="prec-vocalistas"
    aria-labelledby="prec-vocalistas-titulo"
  >
    <p class="rn" data-lt="60" aria-hidden="true">${letters(section.numeral)}</p>
    <h3 class="vt" id="prec-vocalistas-titulo" data-lt="70">
      <span class="sr-only">${section.numeral} ${section.name}</span
      ><span class="vt__lines" aria-hidden="true"
        ><span class="a">${letters(a)}</span><span class="b">${letters(b)}</span
        ><span class="c">${letters(c)}</span></span
      >
    </h3>
    <p class="vcap">${v.caption}</p>
    <figure class="vfig" data-prec-trio>
      <div class="vframe">${picture(ctx, { src: photo.src, alt: photo.alt, sizes: '60vw' })}</div>
    </figure>
  </section>`;
}

/** @param {RenderContext} ctx @param {any} section */
function portraits(ctx, section) {
  const { ui } = ctx.content;
  return html`<section class="prec__after" aria-label="${ui.preciosooo.voices}">
    <div class="mem">
      ${section.members.map(
        (/** @type {{ n: number, name: string, role: string, photo: string }} */ m) =>
          html`<figure class="fig rv">
            <div class="vframe vframe--p">
              ${picture(ctx, { src: m.photo, alt: m.name, sizes: '46vw' })}
            </div>
            <figcaption class="pcap">
              <span class="num">${pad2(m.n)}</span
              ><span><b>${m.name}</b><small>${m.role}</small></span>
            </figcaption>
          </figure>`,
      )}
    </div>
  </section>`;
}

/** @param {RenderContext} ctx */
export function preciosooo(ctx) {
  const { ui } = ctx.content;
  const section = ctx.content.members.sections[4];
  return html`<div class="prec" data-prec>
    <div class="prec__pin" data-prec-pin>
      <div class="prec__stage" data-prec-stage role="region" aria-label="${ui.preciosooo.region}">
        <div class="prec__track" data-prec-track>
          <section class="prec__panel" data-tone="cream" data-prec-pre aria-labelledby="prec-word">
            <div class="wbox">${word(ctx)}</div>
            ${cards(ctx)}
          </section>
          ${voices(ctx, section)}
        </div>
        <p class="hint" data-prec-hint aria-hidden="true">${ui.hero.scrollCue}<i></i></p>
      </div>
    </div>
    ${portraits(ctx, section)}
  </div>`;
}
