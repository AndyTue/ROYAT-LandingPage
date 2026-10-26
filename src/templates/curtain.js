// @ts-check
import { html } from './html.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * Cortina de transición (`features/transition.js`): vacía y decorativa hasta que se usa.
 * @param {RenderContext} _ctx
 */
export function curtain(_ctx) {
  return html`<div class="curtain" data-curtain aria-hidden="true">
    <figure class="curtain__cover" data-curtain-cover hidden></figure>
    <span class="curtain__title" data-curtain-title></span>
  </div>`;
}
