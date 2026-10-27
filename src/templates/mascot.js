// @ts-check
import { html } from './html.js';
import { icon } from './partials/picture.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * Fovi Rodríguez (FOV-1…4): gato de adorno que camina, duerme y dice datos. Es un enlace real a
 * Contacto; sin JS no se muestra (el menú ya lleva al formulario). Las frases se leen del JSON
 * del atributo `data-fovi`, así el texto sigue viviendo en `content/mascot.json`.
 * @param {RenderContext} ctx
 */
export function mascot(ctx) {
  const { mascot: data, ui } = ctx.content;
  const { sleep, torso, tail, legs } = data.sprites;
  const leg = (/** @type {string} */ name, /** @type {string} */ src) =>
    icon(ctx, { src, alt: '', size: 119, className: `fovi__leg fovi__leg--${name}` });
  const lines = { generic: data.generic, facts: data.facts, lines: data.lines };
  return html`<a class="fovi js-only" href="#contacto" data-fovi data-fovi-lines="${JSON.stringify(lines)}" aria-label="${ui.mascot.label}" draggable="false">
    <span class="fovi__in" data-fovi-in>
      <span class="fovi__sleep">${icon(ctx, { src: sleep, alt: '', size: 140 })}</span>
      <span class="fovi__shadow"></span>
      <span class="fovi__walk">
        ${leg('hf', legs.hindFar)}${leg('ff', legs.frontFar)}${leg('hn', legs.hindNear)}${leg('fn', legs.frontNear)}
        ${icon(ctx, { src: torso, alt: '', size: 119 })}
        ${icon(ctx, { src: tail, alt: '', size: 119, className: 'fovi__tail' })}
      </span>
    </span>
  </a>
  <div class="fovi-bubble js-only" data-fovi-bubble aria-hidden="true"><span data-fovi-text></span><small data-fovi-sub></small></div>
  <div class="fovi-fx js-only" data-fovi-fx aria-hidden="true"></div>
  <p class="sr-only" role="status" data-fovi-live></p>`;
}
