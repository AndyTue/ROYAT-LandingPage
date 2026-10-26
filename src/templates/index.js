// @ts-check
import { contact } from './contact.js';
import { curtain } from './curtain.js';
import { discography } from './discography.js';
import { footer } from './footer.js';
import { head } from './head.js';
import { hero } from './hero.js';
import { history } from './history.js';
import { members } from './members.js';
import { nav } from './nav.js';
import { places } from './places.js';

export { createContext } from './context.js';
export { robots, sitemap } from './head.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/** Plantilla de cada marcador `<!-- @section:nombre -->` de index.html. */
export const SECTIONS = /** @type {const} */ ({
  head,
  nav,
  hero,
  history,
  members,
  places,
  discography,
  contact,
  footer,
  curtain,
});

/**
 * Reemplaza los marcadores de index.html con el HTML de cada sección.
 * @param {string} template
 * @param {RenderContext} ctx
 * @returns {string}
 */
export function renderPage(template, ctx) {
  const used = new Set();
  const page = template.replace(/<!--\s*@section:(\w+)\s*-->/g, (_match, name) => {
    const section = SECTIONS[/** @type {keyof typeof SECTIONS} */ (name)];
    if (!section) throw new Error(`index.html pide la sección "${name}", que no existe`);
    used.add(name);
    // Las interpolaciones vacías dejan líneas con solo sangría: se limpian para un HTML válido.
    return String(section(ctx))
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{2,}/g, '\n');
  });
  const missing = Object.keys(SECTIONS).filter((name) => !used.has(name));
  if (missing.length) throw new Error(`Faltan marcadores en index.html: ${missing.join(', ')}`);
  return page;
}
