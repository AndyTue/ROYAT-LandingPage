// @ts-check
import { stitchBandSvg } from '../js/stitch/svg.js';
import { html, raw } from './html.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */
/**
 * @typedef {{ i: number, municipio: string, label: string, state: string, presence: boolean, comisarias: string[] }} Place
 */

const LIST = new Intl.ListFormat('es', { type: 'conjunction' });

/**
 * Cuenta de municipios con presencia por estado, con tope: 52 con tope 50 → "+50" (MAP-2).
 * @param {readonly Place[]} places
 * @param {string} state
 * @param {number} [cap]
 */
export function presenceCount(places, state, cap) {
  const count = places.filter((p) => p.presence && p.state === state).length;
  return cap !== undefined && count > cap ? `+${cap}` : String(count);
}

/**
 * Texto de un municipio en la lista accesible (MAP-6): nombre visible (con el municipio si
 * difiere), y comisarías. "Puerto: Sisal" y similares ya traen su propia etiqueta.
 * @param {Place} place
 * @param {string} comisariasLabel
 */
export function placeText(place, comisariasLabel) {
  const name =
    place.label === place.municipio ? place.label : `${place.label} (${place.municipio})`;
  const labelled = place.comisarias.filter((c) => c.includes(':'));
  const plain = place.comisarias.filter((c) => !c.includes(':'));
  const extras = [
    ...labelled,
    ...(plain.length ? [`${comisariasLabel}: ${LIST.format(plain)}`] : []),
  ];
  return extras.length ? `${name}. ${extras.join('. ')}` : name;
}

/**
 * Presencia (MAP-1…7). Sin JS se ve la lista de municipios; con JS el mapa bordado la vuelve
 * una alternativa solo para lectores de pantalla (MAP-6).
 * @param {RenderContext} ctx
 */
export function places(ctx) {
  const { ui, places: data } = ctx.content;
  const { patterns } = ctx;
  const t = ui.presence;
  const list = /** @type {Place[]} */ (data.places);
  const tour = data.tours[0];
  const hem = stitchBandSvg(patterns.hem, patterns.pal, {
    id: 'presence-hem',
    cell: 6,
    className: 'presence__hem presence__hem--svg',
  });
  return html`<section id="presencia" class="presence" aria-labelledby="presencia-titulo" data-presence data-map-text="${JSON.stringify(t.map)}" data-tone="navy">
    <div class="presence__stage" data-presence-stage>
      ${raw(hem)}
      <canvas class="presence__hem" data-hem aria-hidden="true" hidden></canvas>
      <div class="presence__text">
        <p class="presence__eyebrow">${t.eyebrow}</p>
        <h2 class="presence__title" id="presencia-titulo">
          ${t.titleLines[0]} <em>${t.titleLines.slice(1).join(' ')}</em>
        </h2>
        <ul class="presence__counters">
          ${t.counters.map(
            (
              /** @type {{ state: string, label: string, cap?: number }} */ c,
              /** @type {number} */ index,
            ) =>
              html`<li>
                <button class="counter counter--${index}" type="button" data-filter="${index}" data-cap="${c.cap ?? ''}" aria-pressed="false" disabled>
                  <b class="counter__n" data-count>${presenceCount(list, c.state, c.cap)}</b>
                  <span class="counter__label">
                    <svg class="counter__x" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2.2 2.2l7.6 7.6M9.8 2.2l-7.6 7.6"/></svg>
                    <span>${c.label.split(' ')[0]}<br>${c.label.split(' ').slice(1).join(' ')}</span>
                  </span>
                </button>
              </li>`,
          )}
        </ul>
        ${tour && html`<p class="presence__tour"><em>${t.tourPrefix}</em> ${tour.label}, ${tour.year}</p>`}
        <p class="presence__hint presence__hint--mouse js-only">${t.hint}</p>
        <p class="presence__hint presence__hint--touch js-only">${t.hintTouch}</p>
      </div>
      <div class="presence__map js-only" data-map aria-hidden="true">
        <canvas data-map-canvas="base"></canvas>
        <canvas data-map-canvas="pres"></canvas>
        <canvas data-map-canvas="hi"></canvas>
      </div>
      <div class="mp-tip" data-map-tip aria-hidden="true"><b></b><small></small><span></span></div>
      <div class="mp-card" data-map-card hidden>
        <button class="mp-card__close" type="button" data-card-close aria-label="${t.map.close}">
          <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2 2l8 8M10 2l-8 8"/></svg>
        </button>
        <p class="mp-card__title" data-card-title></p>
        <p class="mp-card__sub label" data-card-sub></p>
        <p class="mp-card__body" data-card-body></p>
        <button class="mp-card__go" type="button" data-card-go>${t.map.inviteHere}<span aria-hidden="true"> →</span></button>
      </div>
      <div class="presence__list">
        <h3 class="presence__list-title">${t.listTitle}</h3>
        ${data.states.map(
          (/** @type {string} */ state) => html`<h4 class="presence__state">${state}</h4>
            <ul class="presence__places">
              ${list
                .filter((p) => p.presence && p.state === state)
                .map((p) => html`<li>${placeText(p, t.comisariasLabel)}</li>`)}
            </ul>`,
        )}
      </div>
    </div>
  </section>`;
}
