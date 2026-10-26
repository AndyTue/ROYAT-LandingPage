// @ts-check
import { readFileSync } from 'node:fs';
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

/**
 * Lee todos los JSON de `content/`.
 * @param {string} [root] carpeta del proyecto
 * @returns {Content}
 */
export function loadContent(root = process.cwd()) {
  return /** @type {Content} */ (
    Object.fromEntries(
      CONTENT_FILES.map((name) => [
        name,
        JSON.parse(readFileSync(join(root, 'content', `${name}.json`), 'utf8')),
      ]),
    )
  );
}
