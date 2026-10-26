// @ts-check
import { fill } from '../js/lib/format.js';
import { stitchSvg } from '../js/stitch/svg.js';
import { html, raw } from './html.js';
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
 * Contacto (CON-1, CON-6 sin JS): logo, redes y un formulario de respaldo que abre WhatsApp
 * con el texto escrito. La carta interactiva (CON-2…8) llega en F4.
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
  return html`<section
    id="contacto"
    class="contact tone tone--cream"
    aria-labelledby="contacto-titulo"
  >
    <div class="contact__brand">
      ${raw(logo)}
      <p class="contact__social-title label">${t.socialTitle}</p>
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
                ${icon(ctx, { src: s.icon, alt: '', size: 48, className: 'social__icon' })}
                <span>${s.label}</span>
              </a>
            </li>`,
        )}
      </ul>
    </div>
    <div class="letter">
      <p class="letter__eyebrow label">${site.contact.eyebrow}</p>
      <h2 class="letter__title" id="contacto-titulo">${emphasizeLast(site.contact.formTitle)}</h2>
      <form
        class="letter__form"
        action="https://wa.me/${site.contact.whatsapp}"
        method="get"
        data-contact-form
      >
        <label class="letter__label" for="contacto-texto">${t.fallback.label}</label>
        <textarea class="letter__text" id="contacto-texto" name="text" rows="6" required>
${t.fallback.template}</textarea>
        <button class="button button--whatsapp" type="submit">${t.send}</button>
        <p class="letter__note">${t.note}</p>
      </form>
    </div>
  </section>`;
}
