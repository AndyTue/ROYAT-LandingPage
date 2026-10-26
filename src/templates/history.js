// @ts-check
import { fill, pad2 } from '../js/lib/format.js';
import { html } from './html.js';
import { picture } from './partials/picture.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * @typedef {{ src: string, alt: string, caption?: string }} Photo
 * @typedef {{ spotifyId: string, label: string }} DiscRef
 * @typedef {{ n: number, year: string, tag: string, title: string, text: string, photos: Photo[], badge?: Photo, discs?: DiscRef[] }} HistoryEvent
 */

/**
 * @param {RenderContext} ctx
 * @param {Photo} photo
 * @param {string} sizes
 */
function figure(ctx, photo, sizes) {
  return html`<figure class="photo">
    ${picture(ctx, { src: photo.src, alt: photo.alt, sizes, className: 'photo__frame' })}
    ${photo.caption && html`<figcaption class="photo__caption">${photo.caption}</figcaption>`}
  </figure>`;
}

/**
 * Discos citados en un hito: enlazan a su ficha en Discografía.
 * @param {RenderContext} ctx
 * @param {DiscRef[]} discs
 */
function discList(ctx, discs) {
  const { discography, ui } = ctx.content;
  const items = discs.map((ref) => {
    const disc = discography.discs.find((/** @type {any} */ d) => d.spotifyId === ref.spotifyId);
    return html`<li>
      <a class="event__disc" href="#disco-${ref.spotifyId}">
        ${picture(ctx, {
          src: disc.cover,
          alt: fill(ui.history.coverAlt, { title: ref.label }),
          sizes: '6rem',
          className: 'event__cover',
        })}
        <span>${ref.label}</span>
      </a>
    </li>`;
  });
  return html`<ul class="event__discs">
    ${items}
  </ul>`;
}

/**
 * @param {RenderContext} ctx
 * @param {HistoryEvent} event
 */
function timelineEvent(ctx, event) {
  const titleId = `hito-${event.n}-titulo`;
  return html`<li class="event" id="hito-${event.n}">
    <article class="event__body" aria-labelledby="${titleId}">
      <p class="event__marker" aria-hidden="true">${pad2(event.n)}</p>
      <p class="event__year">${event.year}</p>
      <p class="event__tag label">${event.tag}</p>
      <h3 class="event__title" id="${titleId}">${event.title}</h3>
      <p class="event__text">${event.text}</p>
      ${
        event.photos.length > 0 &&
        html`<div class="event__photos">
          ${event.photos.map((p) => figure(ctx, p, '(width >= 48em) 40vw, calc(100vw - 5.5rem)'))}
        </div>`
      }
      ${
        event.badge &&
        picture(ctx, {
          src: event.badge.src,
          alt: event.badge.alt,
          sizes: '9rem',
          className: 'event__badge',
        })
      }
      ${event.discs?.length ? discList(ctx, event.discs) : null}
    </article>
  </li>`;
}

/**
 * Historia (HIS-1, HIS-2): apertura y línea de tiempo de los 14 hitos.
 * @param {RenderContext} ctx
 */
export function history(ctx) {
  const { history: data, ui } = ctx.content;
  return html`<section id="historia" class="history" aria-labelledby="historia-titulo">
    <header class="history__intro tone tone--navy">
      <h2 class="section-title" id="historia-titulo">${data.title}</h2>
      <p class="section-kicker label">${data.kicker}</p>
      ${figure(ctx, data.intro.photo, '(width >= 48em) 45vw, calc(100vw - 3rem)')}
      <div class="history__paragraphs">
        ${data.intro.paragraphs.map((/** @type {string} */ p) => html`<p>${p}</p>`)}
      </div>
    </header>
    <ol class="timeline" aria-label="${ui.history.timelineLabel}">
      ${data.events.map((/** @type {HistoryEvent} */ e) => timelineEvent(ctx, e))}
    </ol>
  </section>`;
}
