// @ts-check
import { ABROAD } from '../js/lib/contact.js';
import { fill } from '../js/lib/format.js';
import { stitchBandSvg, stitchSvg } from '../js/stitch/svg.js';
import { attrs, html, raw } from './html.js';
import { icon } from './partials/picture.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * Título con la última palabra en itálica, como en el diseño ("Lleva la jarana a tu *fiesta*").
 * @param {string} title
 */
function emphasizeLast(title) {
  const cut = title.lastIndexOf(' ');
  return cut < 0
    ? html`<em>${title}</em>`
    : html`${title.slice(0, cut)} <em>${title.slice(cut + 1)}</em>`;
}

/**
 * Campo de la carta con su etiqueta oculta a la vista: la frase visible da el contexto y la
 * etiqueta lo nombra para lectores de pantalla. Va deshabilitado en el HTML: sin JS la carta
 * no se muestra y no debe bloquear el envío del formulario de respaldo.
 * @param {{ id: string, label: string, field: string, input?: Record<string, string | number | boolean | null | undefined> }} options
 */
function field({ id, label, field: name, input = {} }) {
  const inputAttrs = attrs({
    class: `field field--${name}`,
    id,
    'data-field': name,
    type: 'text',
    disabled: true,
    ...input,
  });
  return html`<label class="sr-only" for="${id}" data-label="${name}">${label}</label><input${inputAttrs}>`;
}

/**
 * Datos para el JavaScript de la carta: textos que cambian según el lugar, mensajes y el
 * número de WhatsApp. Es un bloque de datos (no se ejecuta): la CSP no lo bloquea.
 * @param {RenderContext} ctx
 */
function letterData(ctx) {
  const { site, ui } = ctx.content;
  const t = ui.contact;
  const data = {
    whatsapp: site.contact.whatsapp,
    capital: t.states.capital,
    peninsula: t.states.peninsula,
    articles: { vaqueria: t.letter.articleFeminine, privado: t.letter.articleMasculine },
    placeholders: t.placeholders,
    labels: t.labels,
    message: t.message,
    errors: t.errors,
    sent: t.sent,
  };
  return raw(JSON.stringify(data).replace(/</g, '\\u003c'));
}

/**
 * Carta-invitación (CON-2…6): una frase con los campos en línea.
 * @param {RenderContext} ctx
 */
function letter(ctx) {
  const { ui, places } = ctx.content;
  const t = ui.contact;
  const L = t.letter;
  const P = t.placeholders;
  const N = t.labels;
  const peninsula = /** @type {{ municipio: string, state: string }[]} */ (places.places)
    .map((p) => ({ name: p.municipio, state: p.state }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const options = (/** @type {string[]} */ list) =>
    list.map((s) => html`<option value="${s}">${s}</option>`);

  return html`<div class="letter__body js-only" data-letter>
    <p class="letter__line">
      <span>${L.greeting}</span>
      ${field({ id: 'ct-name', label: N.name, field: 'name', input: { autocomplete: 'name', maxlength: 80, placeholder: P.name } })}
    </p>
    <p class="letter__line">
      <span>${L.invite}</span> <span data-article>${L.articleFeminine}</span>
    </p>
    <fieldset class="letter__line letter__type">
      <legend class="sr-only">${L.eventTypeLabel}</legend>
      <span class="segment">
        <input class="segment__input sr-only" type="radio" name="event-type" id="ct-vaqueria" value="vaqueria" checked disabled>
        <label class="segment__label" for="ct-vaqueria">${L.vaqueria}</label>
        <span class="segment__sep" aria-hidden="true">/</span>
        <input class="segment__input sr-only" type="radio" name="event-type" id="ct-privado" value="privado" disabled>
        <label class="segment__label" for="ct-privado">${L.privado}</label>
      </span>
      <span class="letter__detail" data-detail hidden>
        ${field({ id: 'ct-detail', label: N.detail, field: 'detail', input: { maxlength: 80, placeholder: P.detail } })}
      </span>
    </fieldset>
    <p class="letter__line">
      <span>${L.on}</span>
      ${field({ id: 'ct-date', label: N.date, field: 'date', input: { type: 'date' } })}
      <span>${L.in}</span>
      ${field({ id: 'ct-locality', label: N.locality, field: 'locality', input: { maxlength: 80, placeholder: P.locality } })}<span>,</span>
    </p>
    <p class="letter__line">
      ${field({ id: 'ct-municipality', label: N.municipality, field: 'municipality', input: { maxlength: 80, placeholder: P.municipality, autocomplete: 'off', list: 'ct-municipalities' } })}<span>,</span>
      <label class="sr-only" for="ct-state">${N.state}</label>
      <select class="field field--state" id="ct-state" data-field="state" disabled>
        <option value="" disabled selected>${P.state}</option>
        <optgroup label="${t.states.peninsulaLabel}">${options(t.states.peninsula)}</optgroup>
        <optgroup label="${t.states.restLabel}">${options(t.states.rest)}</optgroup>
        <optgroup label="${t.states.otherLabel}"><option value="${ABROAD}">${t.states.abroad}</option></optgroup>
      </select><span>.</span>
    </p>
    <p class="letter__line" data-country hidden>
      <span>${L.countryPrefix}</span>
      ${field({ id: 'ct-country', label: N.country, field: 'country', input: { maxlength: 60, placeholder: P.country, autocomplete: 'country-name', list: 'ct-countries' } })}<span>.</span>
    </p>
    <p class="letter__line">
      <span>${L.phonePrefix}</span>
      ${field({ id: 'ct-phone', label: N.phone, field: 'phone', input: { type: 'tel', maxlength: 20, placeholder: P.phone, autocomplete: 'tel', inputmode: 'tel' } })}<span>.</span>
    </p>
    <p class="letter__line">
      <span>${L.postscript}</span>
      ${field({ id: 'ct-message', label: N.message, field: 'message', input: { maxlength: 600, placeholder: P.message } })}
    </p>
    <datalist id="ct-municipalities">
      ${peninsula.map((p) => html`<option value="${p.name}" label="${p.state}"></option>`)}
    </datalist>
    <datalist id="ct-countries"></datalist>
  </div>`;
}

/**
 * Contacto (CON-1…8): logo, redes y la carta. Sin JS se muestra un formulario de respaldo que
 * abre WhatsApp con el texto escrito (CON-6, degradación elegante).
 * @param {RenderContext} ctx
 */
export function contact(ctx) {
  const { site, ui } = ctx.content;
  const t = ui.contact;
  const { patterns } = ctx;
  const logo = stitchSvg(patterns.logo, patterns.pal, {
    id: 'contact-logo',
    label: t.logoLabel,
    className: 'contact__logo',
  });
  const hem = stitchBandSvg(patterns.hem, patterns.pal, {
    id: 'contact-hem',
    cell: 6,
    className: 'contact__hem contact__hem--svg',
  });
  return html`<section
    id="contacto"
    class="contact tone tone--cream"
    aria-labelledby="contacto-titulo"
  >
    ${raw(hem)}
    <canvas class="contact__hem" data-hem aria-hidden="true" hidden></canvas>
    <span class="ornament contact__orn contact__orn--a" data-ornament data-motif="flor5" data-order="out" data-cell-m="1" aria-hidden="true"></span>
    <span class="ornament contact__orn contact__orn--b" data-ornament data-motif="star5" data-order="out" aria-hidden="true"></span>
    <span class="ornament contact__orn contact__orn--c" data-ornament data-motif="rombo" data-order="out" aria-hidden="true"></span>
    <div class="contact__brand">
      <span class="ornament contact__bird" data-ornament data-motif="bird" data-order="out" data-cell-m="0.85" aria-hidden="true"></span>
      ${raw(logo)}
      <span class="ornament contact__stitched" data-ornament data-pattern="logo" data-cell="0.4" data-cell-m="0.375" data-order="lr" aria-hidden="true"></span>
      <p class="contact__social-title">${t.socialTitle}</p>
      <ul class="social">
        ${site.social.map(
          (/** @type {{ label: string, url: string, icon: string }} */ s) =>
            html`<li>
              <a
                class="social__link"
                href="${s.url}"
                target="_blank"
                rel="noopener"
                aria-label="${fill(t.socialLabel, { label: s.label })} ${t.newTab}"
              >
                ${icon(ctx, { src: s.icon, alt: '', size: 72, className: 'social__icon' })}
                <span>${s.label}</span>
              </a>
            </li>`,
        )}
      </ul>
    </div>
    <div class="letter">
      <span class="ornament letter__ornament letter__ornament--tl" data-ornament data-motif="star5" data-order="out" data-cell-m="0.85" aria-hidden="true"></span>
      <span class="ornament letter__ornament letter__ornament--tr" data-ornament data-motif="star5" data-order="out" data-cell-m="0.85" aria-hidden="true"></span>
      <span class="ornament letter__ornament letter__ornament--br" data-ornament data-motif="flor5" data-order="out" aria-hidden="true"></span>
      <p class="letter__eyebrow">${site.contact.eyebrow}</p>
      <h2 class="letter__title" id="contacto-titulo">${emphasizeLast(site.contact.formTitle)}</h2>
      <form
        class="letter__form"
        action="https://wa.me/${site.contact.whatsapp}"
        method="get"
        data-contact-form
      >
        ${letter(ctx)}
        <div class="letter__fallback no-js-only">
          <label class="letter__label" for="contacto-texto">${t.fallback.label}</label>
          <textarea class="letter__text" id="contacto-texto" name="text" rows="6" required>${t.fallback.template}</textarea>
        </div>
        <div class="letter__send">
          <button class="button button--whatsapp letter__button" type="submit">
            <svg class="letter__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/></svg>
            ${t.send}
          </button>
          <p class="letter__note" role="status" data-note>${t.note}</p>
        </div>
        <script type="application/json" data-letter-data>${letterData(ctx)}</script>
      </form>
    </div>
  </section>`;
}
