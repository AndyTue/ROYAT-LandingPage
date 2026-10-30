// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CONTENT_FILES = /** @type {const} */ ([
  'site',
  'history',
  'members',
  'glossary',
  'places',
  'discography',
  'mascot',
  'map-grid',
  'ui',
]);

/** @typedef {typeof CONTENT_FILES[number]} ContentName */
/** @typedef {Record<ContentName, any>} Content */

/** Idiomas del sitio: `es` es el contenido base; los demás se superponen desde `content/<lang>/`. */
export const LANGS = /** @type {const} */ (['es', 'en']);

/** @typedef {typeof LANGS[number]} Lang */

/**
 * Superpone `overlay` sobre `base` sin mutarlos. Los objetos se mezclan por clave y los arreglos
 * por posición; `null` en un arreglo deja el elemento base tal cual. Así la traducción solo
 * trae los textos que cambian (nombres propios, fotos, ids y números se heredan).
 * @param {any} base
 * @param {any} overlay
 * @returns {any}
 */
export function mergeContent(base, overlay) {
  if (overlay === undefined || overlay === null) return base;
  if (Array.isArray(base) && Array.isArray(overlay)) {
    const length = Math.max(base.length, overlay.length);
    return Array.from({ length }, (_, i) => mergeContent(base[i], overlay[i]));
  }
  if (isPlain(base) && isPlain(overlay)) {
    const out = { ...base };
    for (const [key, value] of Object.entries(overlay)) out[key] = mergeContent(base[key], value);
    return out;
  }
  return overlay;
}

/** @param {unknown} value */
const isPlain = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Lee todos los JSON de `content/` y, si `lang` no es `es`, superpone `content/<lang>/<nombre>.json`.
 * @param {string} [root] carpeta del proyecto
 * @param {Lang} [lang]
 * @returns {Content}
 */
export function loadContent(root = process.cwd(), lang = 'es') {
  return /** @type {Content} */ (
    Object.fromEntries(
      CONTENT_FILES.map((name) => {
        const base = JSON.parse(readFileSync(join(root, 'content', `${name}.json`), 'utf8'));
        const file = join(root, 'content', lang, `${name}.json`);
        if (lang === 'es' || !existsSync(file)) return [name, base];
        return [name, mergeContent(base, JSON.parse(readFileSync(file, 'utf8')))];
      }),
    )
  );
}
