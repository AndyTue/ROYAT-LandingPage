// @ts-check
import { createHash } from 'node:crypto';
import { posix } from 'node:path';

/**
 * @typedef {'avif' | 'webp'} Format
 * @typedef {{ width: number, format: Format, file: string }} Variant
 * @typedef {{ src: string, width: number, height: number, variants: Variant[] }} ImagePlan
 */

/** Sube este número si cambia la receta de codificación: invalida todos los hashes. */
export const RECIPE_VERSION = 1;

export const FORMATS = /** @type {const} */ (['avif', 'webp']);

/**
 * Anchos candidatos por carpeta de `assets-src/`, según cómo se muestra cada tipo de imagen
 * (de 1× en móvil a 2× en escritorio).
 * @type {Record<string, number[]>}
 */
export const WIDTHS = {
  photos: [640, 800, 960, 1280, 1920, 2560],
  history: [480, 640, 800, 1200, 1600],
  members: [320, 480, 800, 1200],
  covers: [240, 480, 800],
  brand: [160, 320, 640, 1200],
  social: [80, 160],
  mascot: [150, 300],
};

/** Si la imagen original es más ancha que el mayor candidato por más de esto, se agrega su ancho. */
const KEEP_SOURCE_RATIO = 1.15;

/**
 * Anchos a generar para una imagen: los candidatos que no la agrandan y, si queda mucha
 * resolución sin usar, su propio ancho.
 * @param {string} folder primera carpeta dentro de assets-src (p. ej. `history`)
 * @param {number} sourceWidth
 * @returns {number[]}
 */
export function widthsFor(folder, sourceWidth) {
  const candidates = WIDTHS[folder] ?? WIDTHS.history;
  const kept = candidates.filter((w) => w <= sourceWidth);
  const largest = kept.at(-1) ?? 0;
  if (!kept.length || sourceWidth > largest * KEEP_SOURCE_RATIO) kept.push(sourceWidth);
  return kept;
}

/**
 * Hash corto del contenido de origen y de la receta: cambia si cambia la imagen o cómo se codifica.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function contentHash(bytes) {
  return createHash('sha256').update(bytes).update(`v${RECIPE_VERSION}`).digest('hex').slice(0, 8);
}

/**
 * Planea las variantes de una imagen.
 * @param {string} src ruta desde la raíz, p. ej. `assets-src/history/chemax.webp`
 * @param {{ width: number, height: number, hash: string }} info
 * @returns {ImagePlan}
 */
export function planImage(src, { width, height, hash }) {
  const relative = posix.relative('assets-src', src);
  const folder = relative.split('/')[0];
  const base = posix.join(posix.dirname(relative), posix.parse(relative).name);
  /** @type {Variant[]} */
  const variants = [];
  for (const w of widthsFor(folder, width)) {
    for (const format of FORMATS) {
      variants.push({ width: w, format, file: `img/${base}-${w}.${hash}.${format}` });
    }
  }
  return { src, width, height, variants };
}
