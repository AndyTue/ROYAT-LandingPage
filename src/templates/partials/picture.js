// @ts-check
import { attrs, html } from '../html.js';

/**
 * @typedef {import('../context.js').RenderContext} RenderContext
 * @typedef {import('../context.js').ImageEntry} ImageEntry
 */

/** Ancho preferido del `<img>` de respaldo (navegadores sin srcset, lectores de feeds). */
const FALLBACK_WIDTH = 800;

/**
 * @param {ImageEntry} entry
 * @param {'avif' | 'webp'} format
 */
function srcset(entry, format) {
  return entry.variants
    .filter((v) => v.format === format)
    .map((v) => `${v.file} ${v.width}w`)
    .join(', ');
}

/**
 * `<picture>` con AVIF y WebP responsivos, `width`/`height` para reservar el espacio (CLS 0) y
 * carga diferida salvo que la imagen sea del primer pantallazo (`eager`).
 * @param {RenderContext} ctx
 * @param {{ src: string, alt: string, sizes: string, eager?: boolean, className?: string }} options
 */
export function picture(ctx, { src, alt, sizes, eager = false, className }) {
  const entry = ctx.image(src);
  const webp = entry.variants.filter((v) => v.format === 'webp');
  const fallback = webp.find((v) => v.width >= FALLBACK_WIDTH) ?? webp[webp.length - 1];
  const img = attrs({
    src: fallback.file,
    alt,
    width: entry.width,
    height: entry.height,
    loading: eager ? 'eager' : 'lazy',
    decoding: eager ? null : 'async',
    fetchpriority: eager ? 'high' : null,
  });
  const avif = attrs({ type: 'image/avif', srcset: srcset(entry, 'avif'), sizes });
  const webpSource = attrs({ type: 'image/webp', srcset: srcset(entry, 'webp'), sizes });
  return html`<picture${attrs({ class: className })}><source${avif}><source${webpSource}><img${img}></picture>`;
}

/**
 * `<img>` pequeño (iconos) con WebP en 1× y 2×.
 * @param {RenderContext} ctx
 * @param {{ src: string, alt: string, size: number, className?: string }} options
 */
export function icon(ctx, { src, alt, size, className }) {
  const entry = ctx.image(src);
  const webp = entry.variants.filter((v) => v.format === 'webp');
  const one = webp.find((v) => v.width >= size) ?? webp[webp.length - 1];
  const two = webp.find((v) => v.width >= size * 2) ?? webp[webp.length - 1];
  const img = attrs({
    class: className,
    src: one.file,
    srcset: two === one ? null : `${one.file} 1x, ${two.file} 2x`,
    alt,
    width: size,
    height: Math.round((size * entry.height) / entry.width),
    loading: 'lazy',
    decoding: 'async',
  });
  return html`<img${img}>`;
}
