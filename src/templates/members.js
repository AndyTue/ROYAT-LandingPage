// @ts-check
import { pad2, slugify } from '../js/lib/format.js';
import { html } from './html.js';
import { picture } from './partials/picture.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * @typedef {{ n: number, name: string, role: string, photo: string }} Member
 * @typedef {{ name: string, numeral: string, count?: string | null, groupPhoto: { src: string, alt: string }, members: Member[] }} Section
 */

/** Sección después de la cual va el glosario "¡Preciosooo!" (INT-4). */
const GLOSSARY_AFTER = 'Armonías';

/**
 * Tono de cada sección de la orquesta en la pista: papel y arena se alternan y las voces
 * (la última) cierran en navy, como en el prototipo.
 * @param {number} index
 * @param {number} total
 */
const bandTone = (index, total) => (index === total - 1 ? 'navy' : index % 2 ? 'sand' : 'paper');

/** Decoración de borde superior que se borda al entrar, una por panel. */
const DECO = ['dflor', 'dzig', 'drombos'];

/**
 * Hueco de ornamento bordado (`features/ornaments.js`).
 * @param {string} motif
 * @param {string} order
 * @param {string} className
 * @param {string} [map]
 */
const ornament = (motif, order, className, map = '') =>
  html`<span class="ornament ${className}" data-ornament data-motif="${motif}" data-order="${order}"${map ? html` data-map="${map}"` : ''} aria-hidden="true"></span>`;

/**
 * Tarjeta de músico: número, nombre y rol. El retrato usa el nombre como `alt`, igual que el
 * prototipo; el nombre visible va en el pie.
 * @param {RenderContext} ctx
 * @param {Member} member
 * @param {string} sizes
 */
function memberCard(ctx, member, sizes) {
  return html`<figure class="member" data-parallax="0.07">
    ${picture(ctx, { src: member.photo, alt: member.name, sizes, className: 'member__photo' })}
    <figcaption class="member__caption">
      <span class="member__n">${pad2(member.n)}</span>
      <span class="member__name">${member.name}</span>
      <span class="member__role">${member.role}</span>
    </figcaption>
  </figure>`;
}

/** Color de cada sobre del glosario, en el orden del prototipo (crema, navy, naranja). */
const ENVELOPES = ['w', 'n', 'o', 'w', 'n', 'o'];

/**
 * Motivos bordados de la pista del glosario, `[motivo, orden, posición (go-N)]`. Las posiciones
 * viven en `members.css`.
 * @type {readonly (readonly [string, string])[]}
 */
const GLOSSARY_ORNAMENTS = [
  ['seam', 'down'],
  ['dzig', 'lr'],
  ['drombos', 'lr'],
  ['dflor', 'lr'],
  ['flor5', 'lr'],
  ['dzig', 'lr'],
  ['drombos', 'lr'],
  ['dflor', 'lr'],
  ['flor5', 'lr'],
  ['dzig', 'lr'],
  ['mari', 'out'],
  ['bird', 'out'],
  ['birdl', 'out'],
  ['rombo', 'out'],
  ['mari', 'out'],
];

/** @param {RenderContext} ctx */
function glossary(ctx) {
  const { glossary: data } = ctx.content;
  // "Preciosooooo": la palabra y sus «o», que ruedan con el scroll, y el símbolo ROYAT al final.
  const head = String(data.title).replace(/o+$/, '');
  const tail = [...String(data.title).slice(head.length)];
  return html`<aside class="glossary" data-tone="cream" aria-labelledby="glosario-titulo">
    ${GLOSSARY_ORNAMENTS.map(([motif, order], i) => ornament(motif, order, `glossary__orn go-${i + 1}`, i === 14 ? 'eg,gj' : ''))}
    <h3 class="glossary__title" id="glosario-titulo">
      <span class="sr-only">${data.title}</span>
      <span class="glossary__word" aria-hidden="true">
        <span data-letters>${head}</span>${tail.map(() => html`<span class="glossary__o" data-roll>o</span>`)}${picture(ctx, { src: 'assets-src/brand/simbolo.png', alt: '', sizes: '(width >= 48em) 40svh, 25vw', className: 'glossary__symbol', data: { 'data-roll': 'symbol' } })}
      </span>
    </h3>
    <dl class="glossary__list">
      ${data.items.map(
        (/** @type {{ term: string, text: string }} */ item, /** @type {number} */ i) =>
          html`<div class="glossary__item glossary__item--${ENVELOPES[i % ENVELOPES.length]}" data-parallax="0.1"><dt>${item.term}</dt><dd>${item.text}</dd></div>`,
      )}
    </dl>
  </aside>`;
}

/**
 * @param {RenderContext} ctx
 * @param {Section} section
 * @param {number} index
 * @param {number} total
 */
function bandSection(ctx, section, index, total) {
  const { ui } = ctx.content;
  const id = `seccion-${slugify(section.name)}`;
  const isVocals = index === total - 1;
  const voices = /** @type {string[]} */ (ui.members.vocalists.titleLines);
  return html`<section class="band${isVocals ? ' band--vocals' : ''}" id="${id}" data-tone="${bandTone(index, total)}" aria-labelledby="${id}-titulo">
    ${ornament('seam', 'down', 'band__seam')}
    ${ornament(DECO[index % DECO.length], 'lr', 'band__deco')}
    <header class="band__header">
      <p class="band__numeral" aria-hidden="true">${section.numeral}</p>
      <h3 class="band__title" id="${id}-titulo">
        <span class="sr-only">${section.numeral} ${section.name}</span>
        ${
          isVocals
            ? html`<span class="band__display" aria-hidden="true">${voices[0]} <em>${voices[1]}</em> <em class="band__display-big">${voices[2]}</em></span>`
            : html`<span class="band__display" aria-hidden="true">${section.name}</span>`
        }
      </h3>
      ${section.count && html`<p class="band__count label">${section.count}</p>`}
      ${isVocals && html`<p class="band__count label">${ui.members.vocalists.caption}</p>`}
      ${isVocals ? ornament('bird', 'out', 'band__sprig') : ornament('sprig', 'out', 'band__sprig')}
    </header>
    ${picture(ctx, {
      src: section.groupPhoto.src,
      alt: section.groupPhoto.alt,
      sizes: '(width >= 48em) 34svh, calc(100vw - 2rem)',
      className: 'band__photo',
      data: { 'data-parallax': '0.05' },
    })}
    <ul class="band__members">
      ${section.members.map(
        (m) => html`<li>${memberCard(ctx, m, '(width >= 48em) 26svh, 50vw')}</li>`,
      )}
    </ul>
  </section>`;
}

/**
 * Integrantes (INT-1…5): apertura, director, cinco secciones y glosario. En escritorio con JS
 * es una pista horizontal fija; en móvil, sin JS o con reduced-motion, una columna.
 * @param {RenderContext} ctx
 */
export function members(ctx) {
  const { members: data, ui } = ctx.content;
  const sections = /** @type {Section[]} */ (data.sections);
  const lines = /** @type {string[]} */ (ui.members.titleLines);
  return html`<section id="integrantes" class="members" aria-labelledby="integrantes-titulo" data-track="integrantes">
    <div class="track__stage" data-track-stage>
      <div class="track__rail" data-track-rail>
        <header class="members__intro" data-tone="navy">
          ${ornament('seam', 'down', 'members__seam')}
          ${ornament('dzig', 'lr', 'members__deco')}
          ${ornament('drombos', 'lr', 'members__deco-b')}
          ${ornament('dflor', 'lr', 'members__deco-c')}
          <h2 class="members__title" id="integrantes-titulo">
            <span class="sr-only">${data.title}</span>
            <span class="members__word" aria-hidden="true">
              ${lines.map((line) => html`<span class="members__line" data-letters>${line}</span>`)}
            </span>
          </h2>
          <p class="members__kicker label">${data.kicker}</p>
          <figure class="photo members__photo" data-parallax="0.06">
            ${picture(ctx, {
              src: data.groupPhoto.src,
              alt: data.groupPhoto.alt,
              sizes: '(width >= 48em) 40vw, calc(100vw - 3rem)',
              className: 'photo__frame',
            })}
            <figcaption class="photo__caption">${data.groupPhoto.caption}</figcaption>
          </figure>
          <ol class="members__index">
            ${sections.map(
              (s) =>
                html`<li><a href="#seccion-${slugify(s.name)}">${s.numeral} ${s.name}</a></li>`,
            )}
          </ol>
          ${ornament('bird', 'out', 'members__bird')}
          ${ornament('corner', 'out', 'members__corner')}
        </header>
        <article class="director" data-tone="red" aria-label="${ui.members.directorLabel}">
          ${ornament('seam', 'down', 'band__seam')}
          ${memberCard(ctx, data.director, '(width >= 48em) 40svh, 80vw')}
        </article>
        ${sections.map(
          (s, i) =>
            html`${bandSection(ctx, s, i, sections.length)}${s.name === GLOSSARY_AFTER && glossary(ctx)}`,
        )}
      </div>
    </div>
  </section>`;
}
