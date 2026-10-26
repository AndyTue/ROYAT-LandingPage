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
 * Tarjeta de músico: número, nombre y rol. El retrato usa el nombre como `alt`, igual que el
 * prototipo; el nombre visible va en el pie.
 * @param {RenderContext} ctx
 * @param {Member} member
 * @param {string} sizes
 */
function memberCard(ctx, member, sizes) {
  return html`<figure class="member">
    ${picture(ctx, { src: member.photo, alt: member.name, sizes, className: 'member__photo' })}
    <figcaption class="member__caption">
      <span class="member__n">${pad2(member.n)}</span>
      <span class="member__name">${member.name}</span>
      <span class="member__role">${member.role}</span>
    </figcaption>
  </figure>`;
}

/** @param {RenderContext} ctx */
function glossary(ctx) {
  const { glossary: data } = ctx.content;
  return html`<aside class="glossary tone tone--cream" aria-labelledby="glosario-titulo">
    <h3 class="glossary__title" id="glosario-titulo">${data.title}</h3>
    <dl class="glossary__list">
      ${data.items.map(
        (/** @type {{ term: string, text: string }} */ item) =>
          html`<div class="glossary__item">
            <dt>${item.term}</dt>
            <dd>${item.text}</dd>
          </div>`,
      )}
    </dl>
  </aside>`;
}

/**
 * @param {RenderContext} ctx
 * @param {Section} section
 */
function bandSection(ctx, section) {
  const { ui } = ctx.content;
  const id = `seccion-${slugify(section.name)}`;
  const isVocals = section === ctx.content.members.sections.at(-1);
  return html`<section class="band" id="${id}" aria-labelledby="${id}-titulo">
    <header class="band__header">
      <h3 class="band__title" id="${id}-titulo">
        <span class="band__numeral">${section.numeral}</span> ${section.name}
      </h3>
      ${section.count && html`<p class="band__count label">${section.count}</p>`}
      ${isVocals && html`<p class="band__count label">${ui.members.vocalists.caption}</p>`}
    </header>
    ${picture(ctx, {
      src: section.groupPhoto.src,
      alt: section.groupPhoto.alt,
      sizes: '(min-width: 48em) 40vw, 100vw',
      className: 'band__photo',
    })}
    <ul class="band__members">
      ${section.members.map(
        (m) =>
          html`<li>
            ${memberCard(ctx, m, '(min-width: 64em) 18vw, (min-width: 48em) 30vw, 50vw')}
          </li>`,
      )}
    </ul>
  </section>`;
}

/**
 * Integrantes (INT-1…5): apertura, índice, director, cinco secciones y glosario.
 * @param {RenderContext} ctx
 */
export function members(ctx) {
  const { members: data, ui } = ctx.content;
  const sections = /** @type {Section[]} */ (data.sections);
  return html`<section id="integrantes" class="members" aria-labelledby="integrantes-titulo">
    <header class="members__intro tone tone--navy">
      <h2 class="section-title" id="integrantes-titulo">${data.title}</h2>
      <p class="section-kicker label">${data.kicker}</p>
      <figure class="photo">
        ${picture(ctx, {
          src: data.groupPhoto.src,
          alt: data.groupPhoto.alt,
          sizes: '(min-width: 64em) 50vw, 100vw',
          className: 'photo__frame',
        })}
        <figcaption class="photo__caption">${data.groupPhoto.caption}</figcaption>
      </figure>
      <ol class="members__index">
        ${sections.map(
          (s) => html`<li><a href="#seccion-${slugify(s.name)}">${s.numeral} ${s.name}</a></li>`,
        )}
      </ol>
    </header>
    <article class="director tone tone--red" aria-label="${ui.members.directorLabel}">
      ${memberCard(ctx, data.director, '(min-width: 48em) 30vw, 80vw')}
    </article>
    ${sections.map(
      (s) => html`${bandSection(ctx, s)}${s.name === GLOSSARY_AFTER && glossary(ctx)}`,
    )}
  </section>`;
}
