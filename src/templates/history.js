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

/** Motivos bordados sobre el hilo de la línea de tiempo, uno por hito. */
const ORNAMENTS = ['flor5', 'star5', 'rombo'];

/** Decoración de borde que acompaña a cada hito: una arriba y otra abajo, alternando. */
const EDGE_TOP = ['dflor', 'dzig'];
const EDGE_BOTTOM = ['flor5', 'drombos'];

/**
 * Motivos sueltos (pájaros, mariposas, esquinas) que salpican la pista, por hito. `at` es una
 * de las posiciones de `history.css` (`x-1`…`x-5`).
 * @type {Record<number, { motif: string, at: number, flip?: string, map?: string }[]>}
 */
const EXTRAS = {
  1: [{ motif: 'corner', at: 5, flip: 'xy' }],
  2: [
    { motif: 'mari', at: 1 },
    { motif: 'corner', at: 2, flip: 'xy', map: 'be,cg,jc' },
  ],
  4: [
    { motif: 'bird', at: 3 },
    { motif: 'corner', at: 2, flip: 'xy', map: 'bl,cf' },
  ],
  6: [{ motif: 'birdl', at: 1 }],
  8: [{ motif: 'rombo', at: 4 }],
  10: [{ motif: 'birdl', at: 4 }],
  11: [{ motif: 'mari', at: 1 }],
  12: [{ motif: 'mari', at: 3, map: 'eg,gj' }],
};

/**
 * Hueco de ornamento bordado (`features/ornaments.js`).
 * @param {string} motif
 * @param {string} className
 * @param {{ order?: string, flip?: string, map?: string }} [opts]
 */
const stitch = (motif, className, { order = 'out', flip = '', map = '' } = {}) =>
  html`<span class="ornament ${className}" data-ornament data-motif="${motif}" data-order="${order}"${flip ? html` data-flip="${flip}"` : ''}${map ? html` data-map="${map}"` : ''} aria-hidden="true"></span>`;

/**
 * Tono de fondo de cada hito en la pista horizontal (HIS-5): papel y arena se alternan y el
 * último hito (la gira) cierra en rojo.
 * @param {number} n
 * @param {number} total
 */
export const toneOf = (n, total) => (n === total ? 'red' : n % 2 ? 'paper' : 'sand');

/**
 * @param {RenderContext} ctx
 * @param {Photo} photo
 * @param {string} sizes
 * @param {Record<string, string>} [data]
 */
function figure(ctx, photo, sizes, data) {
  const { width, height } = ctx.image(photo.src);
  const shape = height > width * 1.1 ? 'portrait' : 'landscape';
  return html`<figure class="photo photo--${shape}"${data ? attrsOf(data) : ''}>
    ${picture(ctx, { src: photo.src, alt: photo.alt, sizes, className: 'photo__frame' })}
    ${photo.caption && html`<figcaption class="photo__caption">${photo.caption}</figcaption>`}
  </figure>`;
}

/** @param {Record<string, string>} data */
const attrsOf = (data) => html`${Object.entries(data).map(([k, v]) => html` ${k}="${v}"`)}`;

/**
 * Discos citados en un hito: vinilos que giran con el scroll y enlazan a su ficha.
 * @param {RenderContext} ctx
 * @param {DiscRef[]} discs
 */
function discList(ctx, discs) {
  const { discography, ui } = ctx.content;
  const items = discs.map((ref) => {
    const disc = discography.discs.find((/** @type {any} */ d) => d.spotifyId === ref.spotifyId);
    return html`<li>
      <a class="event__disc" href="#disco-${ref.spotifyId}">
        <span class="vinyl" data-spin>
          ${picture(ctx, {
            src: disc.cover,
            alt: fill(ui.history.coverAlt, { title: ref.label }),
            sizes: '8rem',
            className: 'event__cover',
          })}
        </span>
        <span class="event__disc-label">${ref.label}</span>
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
 * @param {number} total
 */
function timelineEvent(ctx, event, total) {
  const titleId = `hito-${event.n}-titulo`;
  const motif = ORNAMENTS[(event.n - 1) % ORNAMENTS.length];
  // A (impares): año arriba y foto debajo. B (pares): foto arriba y año abajo (como el prototipo).
  const variant = event.n % 2 ? 'a' : 'b';
  const edgeIndex = event.n % 2;
  const [first, ...rest] = event.photos;
  return html`<li class="event event--${variant}" id="hito-${event.n}" data-tone="${toneOf(event.n, total)}">
    <article class="event__body" aria-labelledby="${titleId}">
      <p class="event__marker" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" focusable="false"><path d="M5 5l14 14M19 5L5 19"/></svg>
        <span>${pad2(event.n)}</span>
      </p>
      <span class="ornament event__ornament" data-ornament data-motif="${motif}" data-order="out" aria-hidden="true"></span>
      ${stitch(EDGE_TOP[edgeIndex], 'event__edge event__edge--top', { order: 'lr' })}
      ${stitch(EDGE_BOTTOM[edgeIndex], 'event__edge event__edge--bottom', { order: 'lr' })}
      ${(EXTRAS[event.n] ?? []).map((x) => stitch(x.motif, `event__extra x-${x.at}`, x))}
      <p class="event__year${event.year.length > 4 ? ' event__year--long' : ''}" data-parallax="0.16">${event.year}</p>
      <div class="event__copy" data-parallax="0.06">
        <p class="event__tag label">${event.tag}</p>
        <h3 class="event__title" id="${titleId}">${event.title}</h3>
        <p class="event__text">${event.text}</p>
      </div>
      ${
        first &&
        html`<div class="event__photos">
          ${figure(ctx, first, '(width >= 48em) 40svh, calc(100vw - 5.5rem)', { 'data-parallax': '0.1' })}
          ${rest.map((p) => figure(ctx, p, '(width >= 48em) 22svh, 50vw', { 'data-parallax': '0.22' }))}
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
 * Historia (HIS-1…5): apertura y línea de tiempo de los 14 hitos. En escritorio con JS el
 * escenario fija la pantalla y la pista se recorre en horizontal; en móvil, sin JS o con
 * reduced-motion es una línea de tiempo vertical.
 * @param {RenderContext} ctx
 */
export function history(ctx) {
  const { history: data, ui } = ctx.content;
  const lines = /** @type {string[]} */ (ui.history.titleLines);
  const events = /** @type {HistoryEvent[]} */ (data.events);
  return html`<section id="historia" class="history" aria-labelledby="historia-titulo" data-track="historia">
    <div class="track__stage" data-track-stage>
      <div class="track__rail" data-track-rail>
        <header class="history__intro" data-tone="navy">
          <h2 class="history__title" id="historia-titulo">
            <span class="sr-only">${data.title}</span>
            <span class="history__word" aria-hidden="true">
              ${lines.map((line) => html`<span class="history__line" data-letters>${line}</span>`)}
            </span>
          </h2>
          ${stitch('seam', 'history__orn history__seam', { order: 'down' })}
          ${stitch('dzig', 'history__orn history__edge-a', { order: 'lr' })}
          ${stitch('drombos', 'history__orn history__edge-b', { order: 'lr' })}
          ${stitch('dflor', 'history__orn history__edge-c', { order: 'lr' })}
          ${stitch('corner', 'history__orn history__corner', { map: 'be,cg,jc' })}
          ${stitch('bird', 'history__orn history__bird')}
          <p class="history__kicker label">${data.kicker}</p>
          <div class="history__photo" data-parallax="0.08">${figure(ctx, data.intro.photo, '(width >= 48em) 50vw, calc(100vw - 3rem)')}</div>
          <div class="history__paragraphs">
            ${data.intro.paragraphs.map((/** @type {string} */ p) => html`<p>${p}</p>`)}
          </div>
        </header>
        <ol class="timeline" aria-label="${ui.history.timelineLabel}">
          ${events.map((e) => timelineEvent(ctx, e, events.length))}
        </ol>
      </div>
    </div>
  </section>`;
}
