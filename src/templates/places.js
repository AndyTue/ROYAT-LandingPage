// @ts-check
import { html } from './html.js';

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
 * Presencia (MAP-1…7). Sin JS se ve la lista de municipios; el mapa bordado (F8) la vuelve
 * solo para lectores de pantalla.
 * @param {RenderContext} ctx
 */
export function places({ content }) {
  const { ui, places: data } = content;
  const t = ui.presence;
  const list = /** @type {Place[]} */ (data.places);
  const tour = data.tours[0];
  return html`<section
    id="presencia"
    class="presence tone tone--navy"
    aria-labelledby="presencia-titulo"
  >
    <div class="presence__text">
      <p class="presence__eyebrow label">${t.eyebrow}</p>
      <h2 class="presence__title" id="presencia-titulo">
        ${t.titleLines[0]} <em>${t.titleLines.slice(1).join(' ')}</em>
      </h2>
      <ul class="presence__counters">
        ${t.counters.map(
          (/** @type {{ state: string, label: string, cap?: number }} */ c) =>
            html`<li class="counter">
              <b class="counter__n">${presenceCount(list, c.state, c.cap)}</b>
              <span class="counter__label">${c.label}</span>
            </li>`,
        )}
      </ul>
      ${tour && html`<p class="presence__tour"><em>${t.tourPrefix}</em> ${tour.label}, ${tour.year}</p>`}
      <p class="presence__hint js-only">${t.hint}</p>
    </div>
    <div class="presence__map js-only" data-map aria-hidden="true"></div>
    <div class="presence__list">
      <h3 class="presence__list-title">${t.listTitle}</h3>
      ${data.states.map(
        (/** @type {string} */ state) =>
          html`<h4 class="presence__state">${state}</h4>
            <ul class="presence__places">
              ${list
                .filter((p) => p.presence && p.state === state)
                .map((p) => html`<li>${placeText(p, t.comisariasLabel)}</li>`)}
            </ul>`,
      )}
    </div>
  </section>`;
}
